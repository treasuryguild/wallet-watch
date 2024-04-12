// src/utils/netlifyUtils.js
import fetch from 'node-fetch';
import { NETLIFY_FUNCTION_URL } from '../config/config.js';

export async function sendBalanceChangeToNetlify(walletAddress, newBalance) {
  try {
    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        newBalance,
      }),
    });

    if (response.ok) {
      console.log('Balance change sent to Netlify function');
    } else {
      console.error('Error sending balance change to Netlify function:', response.status);
    }
  } catch (error) {
    console.error('Error sending balance change to Netlify function:', error);
  }
}