// src/config/config.js
export const WALLET_ADDRESSES = [
    '5GGxt4D7rGu89zTMCp5rxvzuaq8F1eVPobwxpeADEiPDoQxZ',
    '5FmuQEdBC6BZcLWAngpo2owTFyeAWe9xR7LHZwd6kNE8WV5T',
    // Add more wallet addresses as needed
  ];
  
export const PROVIDERS = [
  { name: 'Aleph Zero Testnet', url: 'wss://ws.test.azero.dev' },
  { name: 'Polkadot', url: 'wss://rpc.polkadot.io' },
  // Add more providers as needed
];

export const SUBSCAN_URLS = [
  { name: 'Aleph Zero Testnet', url: 'https://alephzero-testnet.api.subscan.io' },
  { name: 'Polkadot', url: 'https://polkadot.api.subscan.io' },
  // Add more WebSocket URLs as needed
];

  export const NETLIFY_FUNCTION_URL = 'https://your-netlify-site.netlify.app/api/handle-balance-change';
  export const PORT = process.env.PORT || 4000;