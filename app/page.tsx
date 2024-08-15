import React from 'react';
import EssayReviewForm from './components/EssayReviewForm';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-[70px]">Essay Review AI</h1>
      <EssayReviewForm />
    </main>
  );
}