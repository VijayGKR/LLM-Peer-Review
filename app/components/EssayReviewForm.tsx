'use client';

import React, { useState , useRef} from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function EssayReviewForm() {
  const [userEssay, setUserEssay] = useState('');
  const [prompt, setPrompt] = useState('');
  const [reviewedEssay, setReviewedEssay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedEssayParts, setReviewedEssayParts] = useState<(string | Edit)[]>([]);
  const [pendingParts, setPendingParts] = useState<(string | Promise<Edit | null>)[]>([]);

  interface Edit {
    type: 'REPLACE' | 'INSERT' | 'COMMENT';
    oldText?: string;
    newText?: string;
    reason: string;
  }

  const handleEssayChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserEssay(event.target.value);
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };


  function preprocessInput(input: string): string {
    return input.replace(/\\"/g, '"');
  }

  async function parseMarkup(input: string): Promise<Edit | null> {
    const processedInput = preprocessInput(input);

    const commentMatch = processedInput.match(/<COMMENT reason="(.+?)"\/>/);
    const replaceMatch = processedInput.match(/<REPLACE new="(.+?)" reason="(.+?)">(.*?)<\/REPLACE>/);
    const insertMatch = processedInput.match(/<INSERT text="(.+?)" reason="(.+?)"\/>/);

    if (commentMatch) {
        return {
            type: 'COMMENT',
            reason: commentMatch[1]
        };
    } else if (replaceMatch) {
        return {
            type: 'REPLACE',
            oldText: replaceMatch[3],
            newText: replaceMatch[1],
            reason: replaceMatch[2]
        };
    } else if (insertMatch) {
        return {
            type: 'INSERT',
            newText: insertMatch[1],
            reason: insertMatch[2]
        };
    } else {
        return null;
    }
  }

  interface InlineEditableProps {
    edit: Edit;
  }
  
  const InlineEditable: React.FC<InlineEditableProps> = ({ edit }) => {
    const [isAccepted, setIsAccepted] = useState(false);
    const [isRejected, setIsRejected] = useState(false);
  
    const handleAccept = () => {
      setIsAccepted(true);
      setIsRejected(false);
    };
  
    const handleReject = () => {
      setIsAccepted(false);
      setIsRejected(true);
    };
  
    if (isRejected) {
      if(edit.type === 'REPLACE'){
        return edit.oldText;
      }else{
        return null;
      }
    }
  
    let bgColor = '';
    let displayText = '';
    let textToShow = '';
  
    switch (edit.type) {
      case 'REPLACE':
        bgColor = 'bg-yellow-200';
        displayText = edit.oldText || '';
        textToShow = isAccepted ? (edit.newText || ''): displayText;
        break;
      case 'INSERT':
        bgColor = 'bg-green-200';
        displayText = '+';
        textToShow = isAccepted ? (edit.newText || '') : displayText;
        break;
      case 'COMMENT':
        bgColor = 'bg-blue-200';
        displayText = '💬';
        textToShow = displayText;
        break;
    }
  
    return (
      <span className="relative group">
        <span className={`cursor-pointer ${bgColor}`}>
          {textToShow}
        </span>
        {!isAccepted && (
          <span className="absolute bottom-full left-0 bg-white border border-gray-300 p-4 rounded shadow-lg hidden group-hover:block w-96 z-10">
            <p className="font-semibold mb-2">{edit.type}</p>
            {edit.newText && <p className="text-green-600 mb-2">{edit.newText}</p>}
            <p className="text-sm text-gray-600 mb-4">{edit.reason}</p>
            <div className="flex justify-between">
              <button
                onClick={handleAccept}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
              >
                {edit.type === 'COMMENT' ? 'Got it' : 'Accept'}
              </button>
              {edit.type !== 'COMMENT' && (
                <button
                  onClick={handleReject}
                  className="text-red-500 border-red-500 border hover:bg-red-50 px-3 py-1 rounded"
                >
                  Reject
                </button>
              )}
            </div>
          </span>
        )}
      </span>
    );
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setReviewedEssayParts([]);
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
          
          
          buffer += decoder.decode(value);
          
          if (!startedStreaming) {
            const markedUpTextIndex = buffer.indexOf('"markedUpText": "');
            if (markedUpTextIndex !== -1) {
              buffer = buffer.slice(markedUpTextIndex + '"markedUpText": "'.length);
              startedStreaming = true;
            }
          }
      
          if (startedStreaming) {
            let editsToAdd: (string | Edit)[] = [];
            while (buffer.length > 0) {
              if (markupBuffer) {
                const replaceIndex = buffer.indexOf('<R');

                if(replaceIndex !== -1){
                  replaceCase = true;
                }

                if(replaceCase){
                  const closingReplaceIndex = markupBuffer.indexOf('</REPLACE>');
                  if(closingReplaceIndex !== -1){
                    const parsedEdit = await parseMarkup(markupBuffer.slice(1, closingReplaceIndex + 10));
                    if (parsedEdit) {
                      editsToAdd.push(parsedEdit);
                    }
                    buffer = markupBuffer.slice(closingReplaceIndex + 10) + buffer;
                    markupBuffer = '';
                    replaceCase = false;
                  }else{
                    //console.log("in replace case ", markupBuffer);
                    markupBuffer += buffer;
                    buffer = '';
                  }
                }else{
                  const closingIndex = buffer.indexOf('>');
                  if (closingIndex !== -1) {
                    markupBuffer += buffer.slice(0, closingIndex + 1);
                    const parsedEdit = await parseMarkup(markupBuffer.slice(1));
                    if (parsedEdit) {
                      editsToAdd.push(parsedEdit);
                    }
                    console.log("editToAdd: ", parsedEdit);
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
                  //console.log("starting buffer: ", buffer);
                  editsToAdd.push(buffer.slice(0, openingIndex));
                  markupBuffer = '<';
                  buffer = buffer.slice(openingIndex);
                } else {
                  //this is only temporary, need to find a more robust fix
                  //this is susceptible to breaking if a chunk comes in with "\n and no }
                  //it will display the "\n
                  const endingIndex = buffer.indexOf('}')
                  if(endingIndex !== -1){
                    editsToAdd.push(buffer.slice(0, endingIndex - 2));
                    buffer = '';
                  }else{
                    editsToAdd.push(buffer)
                    buffer = '';
                  }
                }
              }
            }

            console.log("editsToAdd: ", editsToAdd);
      
            if (editsToAdd.length > 0) {
              setReviewedEssayParts(prev => {
                const newParts = [...prev];
                editsToAdd.forEach(edit => newParts.push(edit));
                return newParts;
              });
            }

          }

          if (done) break;

        }
      } else {
        throw new Error('Response body is not readable');
      }
    } catch (error) {
      console.error('Error reviewing essay:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      console.log("done");
      setIsLoading(false);
    }
  };

  const renderReviewedEssay = () => {
    return reviewedEssayParts.map((part, index) => {
      if (typeof part === 'string') {
        return part.split('\n').map((line, i) => (
          <React.Fragment key={`${index}-${i}`}>
            {line}
            {i < part.split('\n').length - 1 && <br />}
          </React.Fragment>
        ));
      } else {
        return <InlineEditable key={index} edit={part} />;
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
      {reviewedEssayParts.length > 0 ? (
        <div className="p-4 border rounded-lg bg-white shadow">
          {renderReviewedEssay()}
        </div>
      ) : (
        <div className="p-4 border rounded-lg bg-white shadow">
          <Textarea
            value={userEssay}
            onChange={handleEssayChange}
            placeholder="Enter your essay here..."
            className="w-full h-40 p-2 border rounded"
          />
        </div>
      )}
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