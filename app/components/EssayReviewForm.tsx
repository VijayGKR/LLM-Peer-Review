'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Edit {
  type: 'REPLACE' | 'INSERT' | 'COMMENT';
  id: number;
  oldText?: string;
  newText?: string;
  reason: string;
}

export default function EssayReviewForm() {
  const [userEssay, setUserEssay] = useState('');
  const [prompt, setPrompt] = useState('');
  const [parsedEssay, setParsedEssay] = useState<(string | Edit)[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleEssayChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParsedEssay([]);
    setUserEssay(event.target.value);
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/review-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ essay: userEssay, prompt: prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to get essay review');
      }

      const data = await response.json();
      parseMarkedUpEssay(data.markedUpText);
    } catch (error) {
      console.error('Error reviewing essay:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  const parseMarkedUpEssay = (markedUpEssay: string) => {
    const parts: (string | Edit)[] = [];
    let currentIndex = 0;
    let editId = 0;

    const regex = /<(REPLACE|INSERT|COMMENT)([^>]*)>(.*?)<\/\1>|<(REPLACE|INSERT|COMMENT)([^>]*)\/>|x(.*?)(?=<|\z)/gs;
    let match;

    while ((match = regex.exec(markedUpEssay)) !== null) {
      if (match.index > currentIndex) {
        parts.push(markedUpEssay.slice(currentIndex, match.index));
      }

      if (match[6]) {
        // Regular text
        parts.push(match[6]);
      } else {
        // Edit
        const type = (match[1] || match[4]) as 'REPLACE' | 'INSERT' | 'COMMENT';
        const attributes = match[2] || match[5];
        const content = match[3] || '';

        const newAttr = attributes.match(/new="([^"]*)"/);
        const reasonAttr = attributes.match(/reason="([^"]*)"/);
        const textAttr = attributes.match(/text="([^"]*)"/);

        const edit: Edit = {
          type,
          id: editId++,
          oldText: type === 'REPLACE' ? content : undefined,
          newText: newAttr ? newAttr[1] : (textAttr ? textAttr[1] : undefined),
          reason: reasonAttr ? reasonAttr[1] : ''
        };

        parts.push(edit);
      }

      currentIndex = match.index + match[0].length;
    }

    if (currentIndex < markedUpEssay.length) {
      parts.push(markedUpEssay.slice(currentIndex));
    }

    setParsedEssay(parts);
  };

  const handleAccept = (id: number) => {
    setParsedEssay(prevParsed => 
      prevParsed.map(part => {
        if (typeof part === 'object' && part.id === id) {
          if (part.type === 'REPLACE' || part.type === 'INSERT') {
            return part.newText || '';
          } else {
            return '';
          }
        }
        return part;
      })
    );
  };

  const handleReject = (id: number) => {
    setParsedEssay(prevParsed => 
      prevParsed.map(part => {
        if (typeof part === 'object' && part.id === id) {
          if (part.type === 'REPLACE') {
            return part.oldText || '';
          } else {
            return '';
          }
        }
        return part;
      })
    );
  };

  const renderParsedEssay = () => {
    return parsedEssay.map((part, index) => {
      if (typeof part === 'string') {
        return <span key={index}>{part}</span>;
      } else {
        const { type, id, oldText, newText, reason } = part;
        let bgColor = '';
        let displayText = '';

        switch (type) {
          case 'REPLACE':
            bgColor = 'bg-yellow-200';
            displayText = oldText || '';
            break;
          case 'INSERT':
            bgColor = 'bg-green-200';
            displayText = '+';
            break;
          case 'COMMENT':
            bgColor = 'bg-blue-200';
            displayText = '💬';
            break;
        }

        return (
          <span key={id} className="relative group inline-block">
            <span className={`cursor-pointer ${bgColor}`}>
              {displayText}
            </span>
            <span className="absolute bottom-full left-0 bg-white border border-gray-300 p-4 rounded shadow-lg hidden group-hover:block w-96 z-10">
              <p className="font-semibold mb-2">{type}</p>
              {newText && <p className="text-green-600 mb-2">{newText}</p>}
              <p className="text-sm text-gray-600 mb-4">{reason}</p>
              <div className="flex justify-between">
                <Button onClick={() => handleAccept(id)} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
                  {type === 'COMMENT' ? 'Got it' : 'Accept'}
                </Button>
                {type !== 'COMMENT' && (
                  <Button onClick={() => handleReject(id)} size="sm" variant="outline" className="text-red-500 border-red-500 hover:bg-red-50">
                    Reject
                  </Button>
                )}
              </div>
            </span>
          </span>
        );
      }
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Textarea
        value={prompt}
        onChange={handlePromptChange}
        placeholder="Enter your prompt here..."
        className="w-full h-20 p-2 border rounded"
      />
      <Textarea
        value={userEssay}
        onChange={handleEssayChange}
        placeholder="Enter your essay here..."
        className="w-full h-64 p-2 border rounded"
      />
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Reviewing...' : 'Review Essay'}
      </Button>
      {parsedEssay.length > 0 && (
        <div className="p-4 border rounded-lg bg-white shadow">
          {renderParsedEssay()}
        </div>
      )}
    </div>
  );
}