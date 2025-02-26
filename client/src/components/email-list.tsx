import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Email } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface EmailListProps {
  search: string;
  category: string;
  folder: string;
}

export default function EmailList({ search, category, folder }: EmailListProps) {
  const { data: emails, isLoading } = useQuery<Email[]>({
    queryKey: ['/api/emails', { search, category, folder }]
  });

  const categorizeMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const res = await apiRequest('POST', `/api/emails/${emailId}/categorize`);
      return res.json();
    }
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!emails?.length) {
    return <div>No emails found</div>;
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
                    Categorize
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
