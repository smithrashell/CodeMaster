"use client"

import { useState } from "react"
import { ProblemSidebar } from "@/components/problem-sidebar"
import { Button } from "@/components/ui/button"

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {sidebarOpen ? (
        <ProblemSidebar
          onClose={() => setSidebarOpen(false)}
          onNewAttempt={() => console.log("Starting new attempt...")}
          onSkip={() => console.log("Skipping problem...")}
        />
      ) : null}

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {!sidebarOpen && (
            <Button onClick={() => setSidebarOpen(true)} variant="outline">
              Show Problem Details
            </Button>
          )}

          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Code Editor</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 min-h-[400px] shadow-sm">
              <p className="text-gray-600 dark:text-gray-300">
                Your code editor would go here. The sidebar provides all the problem context you need.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
