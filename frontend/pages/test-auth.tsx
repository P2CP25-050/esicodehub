import { useState } from 'react';
import { login, saveTokens, getAccessToken, clearTokens } from '@/services/auth';

export default function TestAuth() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const testLogin = async () => {
    setLoading(true);
    try {
      const response = await login({
        email: 'student@esi.dz',
        password: 'password123',
      });
      saveTokens(response.data);
      setResult(`✅ Login successful!\nToken: ${getAccessToken()?.slice(0, 20)}...`);
    } catch (error: any) {
      const errorMsg = error.response?.status 
        ? `${error.response.status} - ${JSON.stringify(error.response.data)}`
        : error.message;
      const url = error.config?.url || 'Unknown URL';
      setResult(`❌ Login failed!\nURL: ${url}\nError: ${errorMsg}`);
    }
    setLoading(false);
  };

  const testApiCall = async () => {
    setLoading(true);
    try {
      const response = await import('@/lib/axios').then(m => m.default.get('/auth/me/'));
      setResult(`✅ API call successful!\nResponse: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      setResult(`❌ API call failed: ${error.message}`);
    }
    setLoading(false);
  };

  const testLogout = () => {
    clearTokens();
    setResult('✅ Tokens cleared!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Auth Service Tests</h1>
      <button onClick={testLogin} disabled={loading}>Test Login</button>
      <button onClick={testApiCall} disabled={loading}>Test Protected API Call</button>
      <button onClick={testLogout}>Test Logout</button>
      <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
        {result}
      </pre>
    </div>
  );
}