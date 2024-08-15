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
  const [selectedEdit, setSelectedEdit] = useState<Edit | null>(null);

  interface Edit {
    type: 'REPLACE' | 'INSERT' | 'COMMENT';
    oldText?: string;
    newText?: string;
    reason: string;
    isAccepted?: boolean;
    isRejected?: boolean;
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
    index: number;
  }
  
  const InlineEditable: React.FC<InlineEditableProps> = ({ edit, index }) => {
    let bgColor = '';
    let displayText = '';
    let textToShow = '';
  
    switch (edit.type) {
      case 'REPLACE':
        bgColor = 'bg-yellow-200';
        displayText = edit.oldText || '';
        textToShow = edit.isAccepted ? (edit.newText || '') : displayText;
        break;
      case 'INSERT':
        bgColor = 'bg-green-200';
        displayText = '+';
        textToShow = edit.isAccepted ? (edit.newText || '') : displayText;
        break;
      case 'COMMENT':
        bgColor = 'bg-blue-200';
        displayText = '💬';
        textToShow = displayText;
        break;
    }
  
    if (edit.isRejected) {
      if (edit.type === 'REPLACE') {
        return edit.oldText;
      } else {
        return null;
      }
    }
  
    if (edit.type === 'COMMENT' && edit.isAccepted) {
      return null;
    }
  
    return (
      <span 
        className="relative group"
        onClick={() => setSelectedEdit(edit)}
      >
        <span className={`cursor-pointer ${bgColor}`}>
          {textToShow}
        </span>
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
        return <InlineEditable key={index} edit={part} index={index} />;
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">How to use</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Enter a valid Anthropic API key.</li>
            <li>Input a prompt detailing:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>The purpose of the text</li>
                <li>Any relevant information</li>
                <li>Modifications you want to see</li>
              </ul>
            </li>
            <li>Input your writing in the text box below.</li>
            <li>Click &quot;Review Text&quot; when you are satisfied.</li>
            <li>A review of your text with inline markups will be generated.</li>
            <li>Accept or reject changes by hovering over the marked-up text.</li>
          </ol>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Annotation Legend</h3>
          <ul className="mt-2 space-y-1">
            <li><span className="bg-yellow-200">Highlighted text</span> - Suggested replacement</li>
            <li><span className="bg-green-200">+</span> - Suggested insertion</li>
            <li><span className="bg-blue-200">💬</span> - Comments</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const EditSidebar: React.FC<{ edit: Edit | null }> = ({ edit }) => {
    const handleAccept = () => {
      if (edit) {
        const updatedParts = reviewedEssayParts.map(part => {
          if (typeof part === 'object' && part === edit) {
            return { ...part, isAccepted: true, isRejected: false };
          }
          return part;
        });
        setReviewedEssayParts(updatedParts);
        setSelectedEdit(null);
      }
    };

    const handleReject = () => {
      if (edit) {
        const updatedParts = reviewedEssayParts.map(part => {
          if (typeof part === 'object' && part === edit) {
            return { ...part, isRejected: true, isAccepted: false };
          }
          return part;
        });
        setReviewedEssayParts(updatedParts);
        setSelectedEdit(null);
      }
    };

    return (
      <div className="w-72 ml-4">
        <div className="space-y-4 p-6 border rounded-lg bg-white shadow">
          {edit ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{edit.type}</h3>
              {edit.newText && <p className="text-green-600 mb-2">{edit.newText}</p>}
              {edit.oldText && <p className="text-red-600 mb-2">{edit.oldText}</p>}
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
            </>
          ) : (
            <p className="text-gray-500">Select an edit to view details</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex">
      <Sidebar apiKey={apiKey} setApiKey={setApiKey} apiKeyError={apiKeyError} />
      <div className="flex-grow max-w-3xl ml-4">
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here... default is general improvements"
            className="w-full p-2 border rounded-lg resize-none overflow-hidden"
            rows={3}
            style={{ minHeight: '3em' }}
            onInput={(e) => {
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
            }}
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
                Enter your text here...
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-4 mt-4">
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Reviewing...' : 'Review Text'}
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
      <EditSidebar edit={selectedEdit} />
    </div>
  );
};