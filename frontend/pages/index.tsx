// Health Check
import { useEffect, useState } from 'react';
import apiClient from '../lib/axios';

export default function Home() {
  const [message, setMessage] = useState('Loading......');

  useEffect(() => {
    apiClient.get('/health/')
      .then(response => {
        setMessage(response.data.message);
      })
      .catch(error => {
        console.error(error);
        setMessage('Failed to connect to backend.');
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">ESI Code Sharing Platform</h1>
      <p>Backend says: <span className="font-mono bg-gray-100 p-1">{message}</span></p>
    </div>
  );
}
// Test Check (for REST-API)
// 
// const HomePage = () => {
//   const [data, setData] = useState(null);
// 
//   useEffect(() => {
//     // Fetch data from the backend using a GET request
//     fetch("http://localhost:8000/api/health/")
//       .then((res) => res.json())
//       .then((data) => setData(data.data))
//       .catch((error) => console.error('Error fetching data:', error));
//   }, []); // Empty dependency array ensures this runs only once on component mount
//   
// return (
//     <div>
//       <h1>Dockerised Full-Stack Template</h1>
//       <h3>With Django, React, Postgres, and Docker</h3>
//       <p>{data ? data : "Loading data..."}</p> {/* Display data or loading message */}
//     </div>
//   );
// };
// 
// export default HomePage;
