// src/services/supabaseService.js
import { supabaseAnon } from '../lib/supabaseClient.js';
import updateTransactionTables from './updateTransactionTables.js';

async function getProjectIdByAddress(address) {
  const { data, error } = await supabaseAnon
    .from('wallets')
    .select('project_id')
    .eq('address', address)
    .single();

  if (error) {
    console.error('Error retrieving project_id from wallets table:', error.message);
    return null;
  }

  return data ? data.project_id : null;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function sendTransactionDetailsToSupabase(transactionDetails) {
  const {
    walletAddress,
    fromAddress,
    amount,
    transactionHash,
    blockNumber,
    timestamp,
    fee,
    tokenSymbol,
    tokenDecimals,
    tokenName,
    txType,
  } = transactionDetails;

  // Check if the transaction already exists in the "transactions" table
  const { data: existingTransactions, error: selectError } = await supabaseAnon
    .from('transactions')
    .select('hash')
    .eq('hash', transactionHash)
    .limit(1);
  
  if (selectError) {
    console.error('Error checking for existing transaction:', selectError.message);
    return;
  }
  
  if (existingTransactions.length > 0) {
    console.log('Transaction already exists in the database:', transactionHash);
    return;
  }

  // Check if the receiving address exists in the "wallets" table
  const projectId = await getProjectIdByAddress(walletAddress);

  if (!projectId) {
    console.error('Receiving address not found in wallets table');
    return;
  }

  const formattedDate = formatDate(timestamp * 1000);

  const jsonData = {
    transactionHash,
    blockNumber,
    fromAddress,
    toAddress: walletAddress,
    success: true,
    fee,
    project_id: projectId,
    tx_type: txType,
    contributions: [
      {
        name: txType === 'incoming' ? 'Incoming Rewards' : 'Outgoing Transaction',
        labels: txType === 'incoming' ? ['Rewards'] : ['Transaction'],
        taskDate: formattedDate,
        inputs: [
          {
            fromAddress,
            tokens: [
              {
                token: {
                  symbol: tokenSymbol,
                  name: tokenName,
                  decimals: tokenDecimals,
                  contractAddress: '',
                },
                amount,
              },
            ],
          },
        ],
        outputs: [
          {
            toAddress: walletAddress,
            role: txType === 'incoming' ? ['recipient'] : ['sender'],
            tokens: [
              {
                token: {
                  symbol: tokenSymbol,
                  name: tokenName,
                  decimals: tokenDecimals,
                  contractAddress: '',
                },
                amount,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await updateTransactionTables(jsonData);
    console.log('Transaction details sent to Supabase successfully');
  } catch (error) {
    console.error('Error sending transaction details to Supabase:', error);
  }
}

export { sendTransactionDetailsToSupabase };