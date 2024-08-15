import React from 'react';
import EssayReviewForm from './components/EssayReviewForm';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-[30px]">LLM Peer Review</h1>
      <EssayReviewForm />
    </main>
  );
}