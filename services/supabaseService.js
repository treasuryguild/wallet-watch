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
      } = transactionDetails;
  // Check if the receiving address exists in the "wallets" table
  const projectId = await getProjectIdByAddress(walletAddress);

  if (!projectId) {
    console.error('Receiving address not found in wallets table');
    return;
  }

  const formattedDate = formatDate(timestamp*1000);

  const jsonData = {
    transactionHash,
    blockNumber,
    fromAddress,
    toAddress: walletAddress,
    success: true,
    fee,
    project_id: projectId,
    contributions: [
      {
        name: 'Incoming Rewards',
        labels: ['Rewards'],
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
            role: ['recipient'],
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