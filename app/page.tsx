import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  
  if (userId) {
    redirect("/input");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-blue-600">CardioAuth</h1>
        <p className="text-xl text-gray-700">
          AI-Powered Cardiology Study Authorization System
        </p>
        <p className="text-gray-600 max-w-md mx-auto">
          Reduce authorization processing time from 15-20 minutes to under 2 minutes per patient
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
