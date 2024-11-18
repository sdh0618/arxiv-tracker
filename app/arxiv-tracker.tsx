"use client"

import { useState, useEffect } from 'react'
import { Search, Bookmark, ExternalLink, X, AlertCircle } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { saveSearch, getSearches } from './db'

interface Paper {
  id: string
  title: string
  summary: string
  authors: string[]
  published: string
}

interface Tag {
  id: string
  name: string
}

export default function ArXivTracker() {
  const [query, setQuery] = useState('')
  const [papers, setPapers] = useState<Paper[]>([])
  const [savedPapers, setSavedPapers] = useState<Paper[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [combineTags, setCombineTags] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const resultsPerPage = 10
  const [allTagsSelected, setAllTagsSelected] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('savedPapers')
    const savedTags = localStorage.getItem('tags')
    if (saved) {
      setSavedPapers(JSON.parse(saved))
    }
    if (savedTags) {
      setTags(JSON.parse(savedTags))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers))
    localStorage.setItem('tags', JSON.stringify(tags))
  }, [savedPapers, tags])

  useEffect(() => {
    if (selectedTags.length > 0) {
      searchPapers(0)
    }
  }, [selectedTags])

  const toggleAllTags = () => {
    if (allTagsSelected) {
      setSelectedTags([])
    } else {
      setSelectedTags(tags.map(tag => tag.id))
    }
    setAllTagsSelected(!allTagsSelected)
  }

  const searchPapers = async (page = 0) => {
    setLoading(true)
    setError(null)
    try {
      let searchQuery = query
      if (selectedTags.length > 0) {
        const tagQuery = selectedTags
          .map(tagId => tags.find(tag => tag.id === tagId)?.name)
          .filter(Boolean)
          .map(tag => `all:"${tag}"`)
          .join(combineTags ? '+AND+' : '+OR+')
        searchQuery = tagQuery || query
      }

      if (searchQuery.length > 1000) {
        throw new Error("Search query is too long. Please reduce the number of selected tags.")
      }

      const start = page * resultsPerPage
      const response = await fetch(`https://export.arxiv.org/api/query?search_query=${searchQuery}&start=${start}&max_results=${resultsPerPage}&sortBy=submittedDate&sortOrder=descending`)
      if (!response.ok) {
        throw new Error("Failed to fetch papers. The search query might be too complex.")
      }
      const data = await response.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(data, "text/xml")

      const entries = xmlDoc.getElementsByTagName("entry")
      const totalResults = parseInt(xmlDoc.getElementsByTagName("opensearch:totalResults")[0].textContent || "0", 10)

      const parsedPapers: Paper[] = Array.from(entries).map((entry) => ({
        id: entry.getElementsByTagName("id")[0].textContent || "",
        title: entry.getElementsByTagName("title")[0].textContent || "",
        summary: entry.getElementsByTagName("summary")[0].textContent || "",
        authors: Array.from(entry.getElementsByTagName("author")).map(author => author.getElementsByTagName("name")[0].textContent || ""),
        published: entry.getElementsByTagName("published")[0].textContent || "",
      }))

      setPapers(parsedPapers)
      setTotalResults(totalResults)
      setCurrentPage(page)

      if (parsedPapers.length === 0) {
        setError("No results found. Try broadening your search or using fewer tags.")
      } else {
        await saveSearch(searchQuery, parsedPapers)
      }
    } catch (error) {
      console.error("Error fetching papers:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    }
    setLoading(false)
  }

  const savePaper = (paper: Paper) => {
    setSavedPapers(prev => [...prev, paper])
  }

  const removeSavedPaper = (paperId: string) => {
    setSavedPapers(prev => prev.filter(paper => paper.id !== paperId))
  }

  const saveTag = () => {
    if (query.trim() !== '' && !tags.some(tag => tag.name === query.trim())) {
      const newTag: Tag = { id: Date.now().toString(), name: query.trim() }
      setTags(prev => [...prev, newTag])
      setQuery('')
    }
  }

  const removeTag = (tagId: string) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId))
    setSelectedTags(prev => prev.filter(id => id !== tagId))
  }

  const toggleTagSelection = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">arXiv Paper Tracker</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        <Input
          type="text"
          placeholder="Search arXiv papers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow"
        />
        <Button onClick={() => searchPapers(0)} disabled={loading || selectedTags.length === 0}>
          {loading ? "Searching..." : "Search"}
          <Search className="ml-2 h-4 w-4" />
        </Button>
        <Button onClick={saveTag} variant="outline">
          Save as Tag
        </Button>
        <Button onClick={toggleAllTags} variant="outline">
          {allTagsSelected ? "Unselect All Tags" : "Select All Tags"}
        </Button>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Tags:</h2>
        <div className="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto">
          {tags.sort((a, b) => a.name.localeCompare(b.name)).map(tag => (
            <Badge 
              key={tag.id} 
              variant={selectedTags.includes(tag.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleTagSelection(tag.id)}
            >
              {tag.name}
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-1 h-4 w-4 p-0" 
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag.id)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="combine-tags" 
            checked={combineTags} 
            onCheckedChange={(checked) => setCombineTags(checked as boolean)}
          />
          <label
            htmlFor="combine-tags"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Combine tags with AND (instead of OR)
          </label>
        </div>
        {selectedTags.length > 10 && (
          <p className="text-yellow-600 text-sm mt-2">
            Warning: Using many tags may result in very specific or slow searches.
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search Results</TabsTrigger>
          <TabsTrigger value="saved">Saved Papers</TabsTrigger>
        </TabsList>
        <TabsContent value="search">
          {selectedTags.length === 0 ? (
            <p className="text-gray-600">Select tags to see search results.</p>
          ) : (
            papers.map(paper => (
              <Card key={paper.id} className="mb-4">
                <CardHeader>
                  <CardTitle>{paper.title}</CardTitle>
                  <CardDescription>
                    {paper.authors.join(', ')} - {new Date(paper.published).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{paper.summary.slice(0, 200)}...</p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => savePaper(paper)}>
                    <Bookmark className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <a href={paper.id} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on arXiv
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            ))
          )}
          {selectedTags.length > 0 && (
            <div className="flex justify-between mt-4">
              <Button onClick={() => searchPapers(currentPage - 1)} disabled={currentPage === 0}>
                Previous
              </Button>
              <Button onClick={() => searchPapers(currentPage + 1)} disabled={(currentPage + 1) * resultsPerPage >= totalResults}>
                Next
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="saved">
          {savedPapers.map(paper => (
            <Card key={paper.id} className="mb-4">
              <CardHeader>
                <CardTitle>{paper.title}</CardTitle>
                <CardDescription>
                  {paper.authors.join(', ')} - {new Date(paper.published).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{paper.summary.slice(0, 200)}...</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => removeSavedPaper(paper.id)}>
                  <Bookmark className="mr-2 h-4 w-4" fill="currentColor" />
                  Remove
                </Button>
                <a href={paper.id} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on arXiv
                  </Button>
                </a>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}