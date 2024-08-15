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
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  interface Edit {
    type: 'REPLACE' | 'INSERT' | 'COMMENT';
    oldText?: string;
    newText?: string;
    reason: string;
  }

  const handleEssayChange = (content: string) => {
    setUserEssay(content);
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
  
    if(edit.type === 'COMMENT'){
      if(isAccepted){
        return null;
      }
    }
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
    if (!apiKey.trim()) {
      setApiKeyError("Please enter your API key");
      return;
    }
    setApiKeyError(null);
    setIsLoading(true);
    setReviewedEssayParts([]);
    setError(null);
    try {
      const response = await fetch('/api/review-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
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


  const Sidebar: React.FC<{ apiKey: string; setApiKey: (key: string) => void; apiKeyError: string | null }> = ({ apiKey, setApiKey, apiKeyError }) => (    
    <div className="w-72 ml-4">
      <div className="space-y-4 p-6 border rounded-lg bg-white shadow">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">Anthropic API Key</label>
          <div className="flex">
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-l-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-xs"
              placeholder="Enter your API key"
            />
            <button
              onClick={() => setApiKey('')}
              className="mt-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 text-xs"
            >
              Clear
            </button>
          </div>
          {apiKeyError && (
            <p className="mt-2 text-sm text-red-600">{apiKeyError}</p>
          )}
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Annotation Legend</h3>
          <ul className="mt-2 space-y-1">
            <li><span className="font-bold text-blue-600">Bold Blue</span>: Key points</li>
            <li><span className="italic text-green-600">Italic Green</span>: Supporting evidence</li>
            <li><span className="underline text-red-600">Underlined Red</span>: Areas for improvement</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex mx-4 sm:mx-6 md:mx-8 lg:mx-12">
      <Sidebar apiKey={apiKey} setApiKey={setApiKey} apiKeyError={apiKeyError} />
      <div className="flex-grow max-w-3xl ml-4">
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here... default is general improvements"
            className="w-full p-2 border rounded-lg"
            rows={3}
          />
        </div>
        <div className={`relative ${isLoading ? 'rgb-border' : ''}`}>
          <style jsx>{`
            @keyframes rgb-animation {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .rgb-border::before {
              content: '';
              position: absolute;
              top: -3px;
              left: -3px;
              right: -3px;
              bottom: -3px;
              background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff);
              background-size: 300% 300%;
              animation: rgb-animation 5s ease infinite;
              border-radius: 8px;
              z-index: -1;
              filter: blur(8px);
            }
            [contenteditable]:not(.empty) + div {
              display: none;
            }
          `}</style>
          {reviewedEssayParts.length > 0 ? (
            <div className="p-4 border rounded-lg bg-white shadow">
              {renderReviewedEssay()}
            </div>
          ) : (
            <div 
              className="p-4 border rounded-lg bg-white shadow min-h-[30rem] overflow-y-auto cursor-text relative"
              onClick={(e) => (e.currentTarget.querySelector('[contenteditable]') as HTMLElement)?.focus()}
            >
              <div
                contentEditable
                onInput={(e) => {
                  handleEssayChange(e.currentTarget.textContent || '');
                  e.currentTarget.classList.toggle('empty', !e.currentTarget.textContent);
                }}
                onFocus={(e) => e.currentTarget.classList.remove('empty')}
                onBlur={(e) => e.currentTarget.classList.toggle('empty', !e.currentTarget.textContent)}
                className="w-full h-full outline-none whitespace-pre-wrap empty"
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                }}
              />
              <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                Enter your essay here...
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-4 mt-4">
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Reviewing...' : 'Review Essay'}
          </Button>
          {reviewedEssayParts.length > 0 && (
            <Button onClick={() => setReviewedEssayParts([])}>
              Reset
            </Button>
          )}
        </div>
        {error && (
          <div className="mt-4 p-4 border rounded-lg bg-red-100 text-red-700">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
};