// src/services/polkadotService.js
import { ApiPromise, WsProvider } from '@polkadot/api';
import { sendBalanceChangeToNetlify } from '../utils/netlifyUtils.js';

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

export function subscribeToBalanceChanges(apis, addresses, previousBalances, wsUrls) {
  return addresses.map((address, walletIndex) =>
    apis.map((api, providerIndex) =>
      api.query.system.account(address, async (balance) => {
        const newBalance = balance.data.free.toHuman();
        const previousBalance = previousBalances[walletIndex][providerIndex];

        if (newBalance !== previousBalance) {
          const providerUrl = wsUrls[providerIndex] || 'Unknown Provider';
          console.log(`Balance changed for wallet ${address} on provider ${providerUrl}: ${newBalance}`);

          // Compare the new balance with the previous balance
          if (newBalance > previousBalance) {
            console.log(`Balance increased for wallet ${address} from ${previousBalance} to ${newBalance}`);
            // Send balance change to Netlify function only if the balance increased
            //await sendBalanceChangeToNetlify(address, newBalance);
          }

          // Update the previous balance with the new balance
          previousBalances[walletIndex][providerIndex] = newBalance;
        }
      })
    )
  );
}