import { useNavigate, useSearchParams } from 'react-router-dom';

function Results() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const won = searchParams.get('won') === 'true';
  const role = searchParams.get('role') || 'software_engineer';

  const formatRole = (roleId: string) => {
    return roleId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4 pt-20">
      <div className="max-w-2xl w-full text-center">
        {won ? (
          <div className="space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-5xl font-bold text-white mb-4">You Got the Job!</h1>
            <p className="text-2xl text-purple-200 mb-6">
              Congratulations! You defeated the {formatRole(role)} recruiter boss!
            </p>
            <div className="bg-purple-800 bg-opacity-50 rounded-lg p-6 backdrop-blur-sm border border-purple-600 mb-6">
              <p className="text-purple-200 text-lg">
                Your excellent interview responses proved you have what it takes.
                The offer letter is in the mail!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-6xl mb-4">😔</div>
            <h1 className="text-5xl font-bold text-white mb-4">You Got Ghosted</h1>
            <p className="text-2xl text-purple-200 mb-6">
              The {formatRole(role)} recruiter boss was too tough this time.
            </p>
            <div className="bg-purple-800 bg-opacity-50 rounded-lg p-6 backdrop-blur-sm border border-purple-600 mb-6">
              <p className="text-purple-200 text-lg">
                Don't give up! Practice your STAR method responses and try again.
                Every interview is a learning opportunity!
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => navigate('/level-select')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 shadow-lg w-full sm:w-auto"
          >
            Play Again
          </button>
          <br />
          <button
            onClick={() => navigate('/')}
            className="text-purple-300 hover:text-white underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Results;
