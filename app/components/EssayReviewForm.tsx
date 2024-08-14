'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function EssayReviewForm() {
  const [userEssay, setUserEssay] = useState('');
  const [prompt, setPrompt] = useState('');
  const [reviewedEssay, setReviewedEssay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEssayChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserEssay(event.target.value);
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setReviewedEssay('');
    setError(null);
    try {
      const response = await fetch('/api/review-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ essay: userEssay, prompt: prompt }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get essay review: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        let startedStreaming = false;
        let replaceCase = false;
        let markupBuffer = '';
      
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value);
          
          if (!startedStreaming) {
            const markedUpTextIndex = buffer.indexOf('"markedUpText": "');
            if (markedUpTextIndex !== -1) {
              buffer = buffer.slice(markedUpTextIndex + '"markedUpText": "'.length);
              startedStreaming = true;
            }
          }
      
          if (startedStreaming) {
            let textToAdd = '';
            while (buffer.length > 0) {
              if (markupBuffer) {
                const replaceIndex = buffer.indexOf('<R');

                if(replaceIndex !== -1){
                  replaceCase = true;
                }

                if(replaceCase){
                  const closingReplaceIndex = buffer.indexOf('</REPLACE>');
                  //this is now a replacement case
                  if(closingReplaceIndex !== -1){
                    markupBuffer += buffer.slice(0, closingReplaceIndex + 10);
                    textToAdd += markupBuffer.slice(1)
                    console.log("replace case textToAdd: ", textToAdd);
                    buffer = buffer.slice(closingReplaceIndex + 10);
                    markupBuffer = '';
                    replaceCase = false;
                  }else{
                    //I want to keep building up the buffer
                    markupBuffer += buffer;
                    buffer = '';
                  }
                }else{
                  const closingIndex = buffer.indexOf('>');
                  if (closingIndex !== -1) {
                    markupBuffer += buffer.slice(0, closingIndex + 1);
                    textToAdd += markupBuffer.slice(1);
                    console.log("non replace case textToAdd: ", textToAdd);
                    buffer = buffer.slice(closingIndex + 1);
                    markupBuffer = '';
                  } else {
                    markupBuffer += buffer;
                    buffer = '';
                  }
                }
              } else {
                const openingIndex = buffer.indexOf('<');
                if (openingIndex !== -1) {
                  textToAdd += buffer.slice(0, openingIndex);
                  markupBuffer = '<';
                  buffer = buffer.slice(openingIndex);
                } else {
                  textToAdd += buffer;
                  buffer = '';
                }
              }
            }
      
            if (textToAdd) {
              setReviewedEssay(prev => prev + textToAdd);
            }
          }
        }
      
        // Handle any remaining markupBuffer content
        if (markupBuffer) {
          setReviewedEssay(prev => prev + markupBuffer);
        }
      } else {
        throw new Error('Response body is not readable');
      }
    } catch (error) {
      console.error('Error reviewing essay:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Textarea
        value={prompt}
        onChange={handlePromptChange}
        placeholder="Enter your prompt here..."
        className="w-full h-20 p-2 border rounded"
      />
      {reviewedEssay ? (
        <div className="p-4 border rounded-lg bg-white shadow">
          <pre className="whitespace-pre-wrap">{reviewedEssay}</pre>
        </div>
      ) : (<div className="p-4 border rounded-lg bg-white shadow">
        <Textarea
          value={userEssay}
          onChange={handleEssayChange}
          placeholder="Enter your essay here..."
          className="w-full h-40 p-2 border rounded"
        />
      </div>)}
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Reviewing...' : 'Review Essay'}
      </Button>
      {error && (
        <div className="p-4 border rounded-lg bg-red-100 text-red-700">
          Error: {error}
        </div>
      )}
    </div>
  );
}