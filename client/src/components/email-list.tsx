import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Email } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

interface EmailListProps {
  search: string;
  category: string;
  folder: string;
}

export default function EmailList({ search, category, folder }: EmailListProps) {
  const { data: emails, isLoading, error } = useQuery<Email[]>({    
    queryKey: ['/api/emails', { search, category, folder }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search && search.trim()) params.append('search', search.trim());
      if (category && category !== 'all') params.append('category', category);
      if (folder && folder !== 'all') params.append('folder', folder);
      
      const res = await apiRequest('GET', `/api/emails?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch emails');
      }
      return res.json();
    },
    enabled: true,
    staleTime: 1000 * 60, // 1 minute
    cacheTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: 1000,
    refetchInterval: false
  const categorizeMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest('POST', `/api/emails/${emailId}/categorize`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
    }
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">
          Error loading emails. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!emails?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No emails found. Try adjusting your search or filters.
        </CardContent>
      </Card>
    );
  }

  function getCategoryColor(category: string | null) {
    switch (category) {
      case "INTERESTED": return "bg-green-500";
      case "MEETING_BOOKED": return "bg-blue-500";
      case "NOT_INTERESTED": return "bg-red-500";
      case "SPAM": return "bg-yellow-500";
      case "OUT_OF_OFFICE": return "bg-gray-500";
      default: return "bg-slate-500";
    }
  }

  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <Card key={email.id}>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{email.subject}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  From: {email.from}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {email.category ? (
                  <Badge className={getCategoryColor(email.category)}>
                    {email.category}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => categorizeMutation.mutate(email.id)}
                    disabled={categorizeMutation.isPending}
                  >
                    {categorizeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Categorizing...
                      </>
                    ) : (
                      'Categorize'
                    )}
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                </span>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{email.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
