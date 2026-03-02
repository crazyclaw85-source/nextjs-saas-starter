import { auth } from '@clerk/nextjs/server'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session.userId

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Welcome! Your user ID is: <code className="bg-muted p-1 rounded">{userId}</code>
        </p>
        <div className="mt-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Next.js 15 App Router</li>
            <li>TypeScript Strict Mode</li>
            <li>Tailwind CSS + shadcn/ui</li>
            <li>Clerk Authentication</li>
            <li>Drizzle ORM + PostgreSQL</li>
            <li>tRPC API Routes</li>
          </ul>
        </div>
      </div>
    </main>
  )
}