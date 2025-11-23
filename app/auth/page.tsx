// app/auth/page.tsx
import AuthForm from './auth-form'

export default function AuthPage() {
  return (
    // Use a light gray for the overall page background
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="flex h-full w-full max-w-5xl overflow-hidden rounded-lg shadow-2xl md:h-auto">
        
        {/* Left Side: NEW "Finance" Brand Panel */}
        <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-slate-900 p-12 text-white md:flex">
          
          {/* Large, faint Rupee symbol in the background */}
          <span className="absolute -left-10 -top-10 text-9xl font-bold text-white opacity-5">
            ₹
          </span>
          <span className="absolute -bottom-16 -right-12 text-9xl font-bold text-white opacity-5">
            ₹
          </span>

          {/* Abstract background shapes */}
          <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-indigo-500 opacity-10"></div>
          <div className="absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-sky-400 opacity-10"></div>

          {/* Content */}
          <div className="z-10 flex flex-col items-center text-center">
            {/* Finance Chart SVG Icon */}
            <svg
              className="mb-4 h-20 w-20 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            
            <h1 className="font-serif text-4xl font-bold">
              Portfolio Tracker & Analysis
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Welcome! Get a complete view of your financial world.
            </p>
          </div>
        </div>

        {/* Right Side: Form Panel */}
        <div className="w-full bg-white p-8 md:w-1/2">
          <AuthForm />
        </div>

      </div>
    </div>
  )
}