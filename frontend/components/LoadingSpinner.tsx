//the spinner of the loading page
interface LoadingSpinnerProps {
  message?: string; 
}

export const LoadingSpinner = ({
  message = 'Verifying session...',
}: LoadingSpinnerProps) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050c1a',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid rgba(59,130,246,.15)',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    

      <span
        style={{
          color: '#475569',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '.75rem',
          letterSpacing: '.1em',
        }}
      >
        {message}
      </span>
    </div>
  );
};

