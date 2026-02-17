import { useEffect, useState } from 'react';
import apiClient from '../lib/axios';

export default function Home() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    apiClient.get('/health/')
      .then(response => {
        setMessage(response.data.message);
      })
      .catch(error => {
        console.error(error);
        setMessage('Failed to connect to backend');
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">ESI Code Sharing Platform</h1>
      <p>Backend says: <span className="font-mono bg-gray-100 p-1">{message}</span></p>
    </div>
  );
}
