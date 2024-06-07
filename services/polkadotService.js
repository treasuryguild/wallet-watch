// src/services/polkadotService.js
import { ApiPromise, WsProvider } from '@polkadot/api';
import fetch from 'node-fetch';
import { sendTransactionDetailsToNetlify } from '../utils/netlifyUtils.js';
import { SUBSCAN_URLS, PROVIDERS } from '../config/config.js';
import { supabaseAnon } from '../lib/supabaseClient.js';
import { sendTransactionDetailsToSupabase } from './supabaseService.js';
import { getTransactionDetails } from '../utils/getPolkaTxDetails.js';

export async function connectToProviders(urls) {
  const providers = urls.map(url => new WsProvider(url));
  return Promise.all(providers.map(provider => ApiPromise.create({ provider })));
}

export async function getInitialBalances(apis, addresses) {
  return Promise.all(
    addresses.map(async (address) => {
      const balances = await Promise.all(apis.map(api => api.query.system.account(address)));
      return balances.map(balance => balance.data.free.toHuman());
    })
  );
}

export function subscribeToBalanceChanges(apis, addresses, previousBalances, providers, subscanUrls) {
  const lastProcessedBlockNumbers = new Map();

  return addresses.map((address, walletIndex) =>
    apis.map((api, providerIndex) =>
      api.query.system.account(address, async (balance) => {
        const newBalance = balance.data.free.toHuman();
        const previousBalance = previousBalances[walletIndex][providerIndex];
        const provider = providers[providerIndex];

        if (newBalance !== previousBalance) {
          console.log(`Balance changed for wallet ${address} on provider ${provider.name}: ${newBalance}`);

          // Compare the new balance with the previous balance
          if (newBalance > previousBalance) {
            console.log(`Balance increased for wallet ${address} from ${previousBalance} to ${newBalance}`);

            // Get the appropriate Subscan URL based on the provider
            const subscanUrl = subscanUrls.find(url => url.name === provider.name)?.url;

            // Get the last processed block number for the current wallet and provider
            const lastProcessedBlockNumber = lastProcessedBlockNumbers.get(`${address}-${provider.name}`) || 0;

            // Get the transaction details using Subscan API
            const txDetails = await getTransactionDetails(address, subscanUrl, api, provider.name, lastProcessedBlockNumber);
            console.log('Transaction details:', txDetails);

            if (txDetails.length > 0) {
              for (const transaction of txDetails) {
                const currentBlockNumber = transaction.blockNumber;

                if (currentBlockNumber > lastProcessedBlockNumber) {
                  try {
                    await sendTransactionDetailsToSupabase(transaction);
                    console.log('Transaction details sent to Supabase successfully:', transaction);
                  } catch (error) {
                    console.error('Error sending transaction details to Supabase:', error);
                  }

                  // Update the last processed block number for the current wallet and provider
                  lastProcessedBlockNumbers.set(`${address}-${provider.name}`, currentBlockNumber);
                }
              }
            }
          }

          // Update the previous balance with the new balance
          previousBalances[walletIndex][providerIndex] = newBalance;
        }
      })
    )
  );
}