import { ApiPromise, WsProvider } from '@polkadot/api';
import fetch from 'node-fetch';

// Replace with the addresses of the wallets you want to watch
const WALLET_ADDRESSES = [
  '5GGxt4D7rGu89zTMCp5rxvzuaq8F1eVPobwxpeADEiPDoQxZ',
  '5Ebn7jfZQkcG1axQjBmue5ggwJKC8HzU6ioGC4prpDkvvyYf',
  // Add more wallet addresses as needed
];

// Replace with the WebSocket URLs you want to use
const WSS_URLS = [
  'wss://ws.test.azero.dev',
  'wss://rpc.polkadot.io',
  // Add more WebSocket URLs as needed
];

// Replace with the URL of your Next.js Netlify function
const NETLIFY_FUNCTION_URL = 'https://your-netlify-site.netlify.app/api/handle-balance-change';

// Interval to reconnect to providers (in milliseconds)
const RECONNECT_INTERVAL = 300000; // 5 minutes

let apis = [];
let previousBalances = [];
let subscriptions = [];

async function connectProviders() {
  const providers = WSS_URLS.map(url => new WsProvider(url));
  apis = await Promise.all(providers.map(provider => ApiPromise.create({ provider })));

  previousBalances = await Promise.all(
    WALLET_ADDRESSES.map((address, index) => apis[index].query.system.account(address))
  );

  previousBalances.forEach((balance, index) => {
    console.log(`Initial balance for wallet ${WALLET_ADDRESSES[index]}: ${balance.data.free.toHuman()}`);
  });

  subscriptions = WALLET_ADDRESSES.map((address, index) =>
    apis[index].query.system.account(address, (balance) => {
      if (balance.data.free.toHuman() !== previousBalances[index].data.free.toHuman()) {
        console.log(`Balance changed for wallet ${address}: ${balance.data.free.toHuman()}`);

        // Send balance change to your Next.js Netlify function
        fetch(NETLIFY_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            newBalance: balance.data.free.toHuman(),
          }),
        })
          .then((response) => {
            console.log('Balance change sent to Netlify function');
          })
          .catch((error) => {
            console.error('Error sending balance change to Netlify function:', error);
          });
      }
    })
  );
}

async function reconnectProviders() {
  console.log('Reconnecting to providers...');

  // Unsubscribe from existing subscriptions
  subscriptions.forEach(unsub => unsub());

  // Disconnect from existing providers
  await Promise.all(apis.map(api => api.disconnect()));

  // Connect to providers and set up new subscriptions
  await connectProviders();
}

async function main() {
  await connectProviders();

  // Reconnect to providers every RECONNECT_INTERVAL milliseconds
  setInterval(reconnectProviders, RECONNECT_INTERVAL);
}

main().catch(console.error);