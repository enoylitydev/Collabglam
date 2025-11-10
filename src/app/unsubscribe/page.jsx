'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Processing your unsubscription...');
  const [isError, setIsError] = useState(false);
  const email = searchParams.get('email');

  useEffect(() => {
    if (email) {
      // In a real application, you would make an API call here
      // to your backend's unsubscribe endpoint.
      // For now, we'll just simulate success.
      // Example: fetch(`/api/unsubscribe?email=${email}`)
      //   .then(response => response.json())
      //   .then(data => {
      //     if (data.success) {
      //       setMessage(`You have successfully unsubscribed ${email}. You will no longer receive notifications.`);
      //     } else {
      //       setMessage('Failed to unsubscribe. Please try again or contact support.');
      //       setIsError(true);
      //     }
      //   })
      //   .catch(error => {
      //     console.error('Unsubscribe error:', error);
      //     setMessage('An error occurred during unsubscription. Please try again later.');
      //     setIsError(true);
      //   });

      const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

      if (!baseUrl) {
        setMessage('Unable to unsubscribe because the backend URL is not configured.');
        setIsError(true);
        return;
      }

      fetch(`${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`)
        .then(response => {
          if (!response.ok) throw new Error('Network response was not ok.');
          return response.text(); // Or response.json() if your backend returns JSON
        })
        .then(() => {
          setMessage(`You have successfully unsubscribed confirm@collabglam.com. You will no longer receive notifications.`);
        })
        .catch(error => {
          console.error('Unsubscribe error:', error);
          setMessage('An error occurred during unsubscription. Please try again later.');
          setIsError(true);
        });

    } else {
      setMessage('Invalid unsubscribe link. Email address not found.');
      setIsError(true);
    }
  }, [email]);

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '50px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      textAlign: 'center',
      backgroundColor: '#fff'
    }}>
      <h1 style={{ color: isError ? '#d9534f' : '#FF6B6B', marginBottom: '20px' }}>
        {isError ? 'Unsubscription Failed' : 'Unsubscription Status'}
      </h1>
      <p style={{ fontSize: '1.1em', color: '#555' }}>{message}</p>
      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{
          backgroundColor: '#FF6B6B',
          color: 'white',
          padding: '10px 20px',
          textDecoration: 'none',
          borderRadius: '5px',
          fontSize: '1em'
        }}>
          Go to Homepage
        </a>
      </div>
    </div>
  );
}
