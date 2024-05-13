// updateTransactionTables.js
import { supabaseAnon } from '../lib/supabaseClient.js';

async function getOrCreateTokens(tokens) {
  const tokenNames = tokens.map(token => token.name);
  const { data: existingTokens, error: selectError } = await supabaseAnon
    .from('tokens')
    .select('id, name')
    .in('name', tokenNames);

  if (selectError) {
    console.error('Error selecting tokens:', selectError);
    throw selectError;
  }

  const existingTokenMap = new Map(existingTokens.map(token => [token.name, token.id]));
  const newTokens = tokens.filter(token => !existingTokenMap.has(token.name));

  if (newTokens.length > 0) {
    const { data: insertedTokens, error: insertError } = await supabaseAnon
      .from('tokens')
      .insert(newTokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        contract_address: token.contractAddress
      })))
      .select('id, name');

    if (insertError) {
      console.error('Error inserting new tokens:', insertError);
      throw insertError;
    }

    insertedTokens.forEach(token => existingTokenMap.set(token.name, token.id));
  }

  return existingTokenMap;
}

async function getOrCreateExternalWallets(addresses) {
  const { data: existingWallets, error: selectError } = await supabaseAnon
    .from('external_wallets')
    .select('id, address')
    .in('address', addresses);

  if (selectError) {
    console.error('Error selecting external wallets:', selectError);
    throw selectError;
  }

  const existingWalletMap = new Map(existingWallets.map(wallet => [wallet.address, wallet.id]));
  const newAddresses = addresses.filter(address => !existingWalletMap.has(address));

  if (newAddresses.length > 0) {
    const { data: insertedWallets, error: insertError } = await supabaseAnon
      .from('external_wallets')
      .insert(newAddresses.map(address => ({ address })))
      .select('id, address');

    if (insertError) {
      console.error('Error inserting new external wallets:', insertError);
      throw insertError;
    }

    insertedWallets.forEach(wallet => existingWalletMap.set(wallet.address, wallet.id));
  }

  return existingWalletMap;
}

export default async function updateTransactionTables(jsonData) {
  const { transactionHash, blockNumber, fromAddress, toAddress, success, fee, project_id, contributions = [], tx_type } = jsonData;

  const transactionData = {
    hash: transactionHash,
    block_number: blockNumber,
    from_address: fromAddress,
    to_address: toAddress,
    success: success,
    project_id: project_id,
    fee: fee,
    contributions: contributions,
    tx_type: tx_type
  };

  try {
    // Start a transaction
    await supabaseAnon.rpc('begin');

    const allTokens = contributions.flatMap(contribution =>
      contribution.inputs.flatMap(input =>
        input.tokens.map(token => token.token)
      ).concat(
        contribution.outputs.flatMap(output =>
          output.tokens.map(token => token.token)
        )
      )
    );

    const allExternalAddresses = contributions.flatMap(contribution =>
      contribution.outputs.map(output => output.toAddress)
    );

    const [tokenMap, externalWalletMap] = await Promise.all([
      getOrCreateTokens(allTokens),
      getOrCreateExternalWallets(allExternalAddresses)
    ]);

    const { data: insertedTransaction, error: transactionError } = await supabaseAnon
      .from('transactions')
      .insert({
        ...transactionData,
        data: {
          ...transactionData,
          contributions: contributions.map((contribution, index) => ({
            ...contribution,
            inputs: contribution.inputs.map(input => ({
              ...input,
              tokens: input.tokens.map(token => ({
                ...token,
                token: {
                  id: tokenMap.get(token.token.name),
                  ...token.token
                }
              }))
            })),
            outputs: contribution.outputs.map(output => ({
              ...output,
              tokens: output.tokens.map(token => ({
                ...token,
                token: {
                  id: tokenMap.get(token.token.name),
                  ...token.token
                }
              })),
              externalWalletId: externalWalletMap.get(output.toAddress)
            }))
          }))
        }
      })
      .select('id');

    if (transactionError) {
      console.error('Error inserting transaction:', transactionError);
      throw transactionError;
    }

    transactionData.id = insertedTransaction[0].id;

    if (contributions.length > 0) {
      const contributionData = contributions.map(contribution => ({
        transaction_id: transactionData.id,
        name: contribution.name,
        labels: contribution.labels,
        task_date: contribution.taskDate
      }));

      const { data: insertedContributions, error: contributionError } = await supabaseAnon
        .from('contributions')
        .insert(contributionData)
        .select('id');

      if (contributionError) {
        console.error('Error inserting contributions:', contributionError);
        throw contributionError;
      }

      const contributionIds = insertedContributions.map(contribution => contribution.id);

      const inputData = [];
      const outputData = [];

      contributions.forEach((contribution, index) => {
        const contributionId = contributionIds[index];

        if (contribution.inputs) {
          contribution.inputs.forEach(input => {
            if (input.tokens) {
              input.tokens.forEach(token => {
                const tokenId = tokenMap.get(token.token.name);
                inputData.push({
                  transaction_id: transactionData.id,
                  contribution_id: contributionId,
                  from_address: input.fromAddress,
                  token_id: tokenId,
                  amount: token.amount
                });
              });
            }
          });
        }

        if (contribution.outputs) {
          contribution.outputs.forEach(output => {
            const externalWalletId = externalWalletMap.get(output.toAddress);
            if (output.tokens) {
              output.tokens.forEach(token => {
                const tokenId = tokenMap.get(token.token.name);
                outputData.push({
                  transaction_id: transactionData.id,
                  contribution_id: contributionId,
                  role: output.role,
                  to_address: output.toAddress,
                  token_id: tokenId,
                  amount: token.amount,
                  external_wallet_id: externalWalletId
                });
              });
            }
          });
        }
      });

      if (inputData.length > 0) {
        const { error: inputsError } = await supabaseAnon
          .from('transaction_inputs')
          .insert(inputData);

        if (inputsError) {
          console.error('Error inserting transaction inputs:', inputsError);
          throw inputsError;
        }
      }

      if (outputData.length > 0) {
        const { error: outputsError } = await supabaseAnon
          .from('transaction_outputs')
          .insert(outputData);

        if (outputsError) {
          console.error('Error inserting transaction outputs:', outputsError);
          throw outputsError;
        }
      }
    }

    console.log('Transaction tables updated successfully');

    // Commit the transaction
    await supabaseAnon.rpc('commit');
  } catch (error) {
    // Rollback the transaction in case of an error
    await supabaseAnon.rpc('rollback');
    console.error('Error updating transaction tables:', error);
    throw error;
  }
}