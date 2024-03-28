import { ApiPromise, WsProvider } from '@polkadot/api';
import fetch from 'node-fetch';
import http from 'http';

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

// Port number to bind the server
const PORT = process.env.PORT || 4000;

async function main() {
  const providers = WSS_URLS.map(url => new WsProvider(url));
  const apis = await Promise.all(providers.map(provider => ApiPromise.create({ provider })));
  const previousBalances = await Promise.all(
    WALLET_ADDRESSES.map((address, index) => apis[index].query.system.account(address))
  );

  previousBalances.forEach((balance, index) => {
    console.log(`Initial balance for wallet ${WALLET_ADDRESSES[index]}: ${balance.data.free.toHuman()}`);
  });

  const subscriptions = WALLET_ADDRESSES.map((address, index) =>
    apis[index].query.system.account(address, (balance) => {
      if (balance.data.free.toHuman() !== previousBalances[index].data.free.toHuman()) {
        console.log(`Balance changed for wallet ${address}: ${balance.data.free.toHuman()}`);

        // Send balance change to your Next.js Netlify function
        /*fetch(NETLIFY_FUNCTION_URL, {
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
          });*/
      }
    })
  );

  // Create an HTTP server and bind it to the specified port
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Server is running');
  });

  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

main().catch(console.error);