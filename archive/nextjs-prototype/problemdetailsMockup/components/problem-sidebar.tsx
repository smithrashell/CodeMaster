"use client"

import { X, ChevronLeft, BarChart3, TrendingUp, Tag, Clock, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

interface ProblemSidebarProps {
  onClose?: () => void
  onNewAttempt?: () => void
  onSkip?: () => void
}

export function ProblemSidebar({ onClose, onNewAttempt, onSkip }: ProblemSidebarProps) {
  const problemData = {
    id: 121,
    title: "Best Time to Buy and Sell Stock",
    tags: ["Array", "Dynamic Programming", "Greedy"],
    difficulty: "Easy",
    acceptance: "54.2%",
    submissions: "2.1M",
    attempts: 2,
    lastSolved: "3 days ago",
  }

  return (
    <div className="w-80 bg-[#111827] text-white h-screen flex flex-col p-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-blue-600 text-white text-sm font-semibold">CM</AvatarFallback>
          </Avatar>
          <h2 className="font-semibold text-xl text-white">Problem Details</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-700"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close sidebar</span>
        </Button>
      </header>

      {/* Main Content Card */}
      <div className="bg-[#1F2937] border border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
          <ChevronLeft className="h-4 w-4" />
          <span>Problem #{problemData.id}</span>
        </div>
        <h3 className="font-semibold text-lg leading-tight text-white mb-3">{problemData.title}</h3>
        <Badge className="bg-green-500 text-white hover:bg-green-600 text-xs font-bold px-3 py-1 rounded-full mb-4">
          {problemData.difficulty}
        </Badge>

        <Separator className="bg-gray-700 mb-4" />

        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-white">{problemData.acceptance}</div>
              <div className="text-gray-400 text-xs">Acceptance</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-white">{problemData.submissions}</div>
              <div className="text-gray-400 text-xs">Submissions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tags Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
          <Tag className="h-4 w-4" />
          <span className="font-medium">Tags</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {problemData.tags.map((tag) => (
            <Badge key={tag} className="bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs px-3 py-1.5 rounded-full">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Status Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
          <Clock className="h-4 w-4" />
          <span className="font-medium">Status</span>
        </div>
        <p className="text-white text-sm">
          Attempts: {problemData.attempts} | Last Solved: {problemData.lastSolved}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto space-y-3">
        <Button
          onClick={onNewAttempt}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base"
          size="lg"
        >
          <Play className="h-4 w-4 mr-2" />
          New Attempt
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-gray-400 hover:text-white hover:bg-transparent">
          Skip Problem
        </Button>
      </div>
    </div>
  )
}
