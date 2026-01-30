import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-600">CardioAuth</h1>
          <p className="text-gray-600 mt-2">Cardiology Authorization System</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
