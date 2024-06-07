// src/utils/getPolkaTxDetails.js
// Description: This file contains the function to fetch transaction details from Subscan API for a given wallet address.
import fetch from 'node-fetch';
import { sendTransactionDetailsToNetlify } from '../utils/netlifyUtils.js';
import { SUBSCAN_URLS, PROVIDERS } from '../config/config.js';
import { supabaseAnon } from '../lib/supabaseClient.js';
import { sendTransactionDetailsToSupabase } from '../services/supabaseService.js';

export async function getTransactionDetails(address, subscanUrl, api, providerName, lastProcessedBlockNumber, maxAttempts = 15, pollInterval = 5000) {
    async function fetchTransactionDetails() {
      const apiUrl = `${subscanUrl}/api/v2/scan/transfers`;
      const params = {
        address: address,
        row: 10,
        page: 0,
      };
  
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
  
      if (response.ok) {
        const data = await response.json();
  
        if (data && data.data && data.data.transfers && data.data.transfers.length > 0) {
          // Sort the transfers by timestamp in descending order
          const sortedTransfers = data.data.transfers.sort((a, b) => b.block_timestamp - a.block_timestamp);
          return sortedTransfers;
        }
      }
  
      return [];
    }
  
    async function getExistingTransactionHashes() {
      const { data: transactions, error: transactionsError } = await supabaseAnon
        .from('transactions')
        .select('hash');
  
      if (transactionsError) {
        console.error('Error fetching existing transaction hashes from Supabase:', transactionsError.message);
        return [];
      }
  
      return transactions.map(transaction => transaction.hash);
    }
  
    async function isHashInPendingTransactions(hash) {
      const maxRetries = 3;
      const retryDelay = 5000;
  
      for (let retry = 0; retry < maxRetries; retry++) {
        const { data: pendingTransactions, error: pendingTransactionsError } = await supabaseAnon
          .from('pending_transactions')
          .select('hash')
          .eq('hash', hash);
  
        if (pendingTransactionsError) {
          console.error('Error fetching pending transaction hash from Supabase:', pendingTransactionsError.message);
          return false;
        }
  
        if (pendingTransactions.length > 0) {
          return true;
        }
  
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
  
      return false;
    }
  
    let attempts = 0;
    let newTransactionsFound = false;
    let existingTransactionHashes = await getExistingTransactionHashes();
  
    while (attempts < maxAttempts && !newTransactionsFound) {
        console.log(`Attempt ${attempts + 1} of ${maxAttempts} to fetch new transaction details for wallet ${address} on provider ${providerName}`);
        const transactionDetails = await fetchTransactionDetails();
    
        if (transactionDetails.length > 0) {
          const newTransactions = [];
    
          for (const transaction of transactionDetails) {
            const isExistingTransaction = existingTransactionHashes.includes(transaction.hash);
            const isPendingTransaction = await isHashInPendingTransactions(transaction.hash);
    
            if (!isExistingTransaction && !isPendingTransaction) {
              newTransactions.push(transaction);
              existingTransactionHashes.push(transaction.hash);
            }
          }
    
          if (newTransactions.length > 0) {
            newTransactionsFound = true;
            console.log(`New transactions found on attempt ${attempts + 1}`);
    
            const tokenDecimals = api.registry.chainDecimals[0];
            const tokenSymbol = api.registry.chainTokens[0];
    
            for (const transaction of newTransactions) {
              const txType = transaction.from === address ? 'outgoing' : 'incoming';
              const currentBlockNumber = transaction.block_num;
    
              if (currentBlockNumber > lastProcessedBlockNumber) {
                const txDetails = {
                  walletAddress: transaction.to,
                  fromAddress: transaction.from,
                  amount: transaction.amount,
                  transactionHash: transaction.hash,
                  blockNumber: transaction.block_num,
                  timestamp: transaction.block_timestamp,
                  fee: transaction.fee,
                  tokenSymbol,
                  tokenDecimals,
                  tokenName: providerName,
                  txType,
                };
    
                try {
                  await sendTransactionDetailsToSupabase(txDetails);
                  console.log('Transaction details sent to Supabase successfully:', txDetails);
                } catch (error) {
                  console.error('Error sending transaction details to Supabase:', error);
                }
              }
            }
    
            return newTransactions.map(transaction => ({
              walletAddress: transaction.to,
              fromAddress: transaction.from,
              amount: transaction.amount,
              transactionHash: transaction.hash,
              blockNumber: transaction.block_num,
              timestamp: transaction.block_timestamp,
              fee: transaction.fee,
              tokenSymbol,
              tokenDecimals,
              tokenName: providerName,
              txType: transaction.from === address ? 'outgoing' : 'incoming',
            }));
          }
        }
    
        attempts++;
        if (attempts < maxAttempts) {
            console.log(`Waiting for ${pollInterval}ms before the next attempt...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    
    if (attempts === maxAttempts) {
        console.log(`Reached the maximum number of attempts (${maxAttempts}). No new transaction details found.`);
    }
    return [];
}