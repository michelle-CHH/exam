'use client';

import React, { useState, useEffect } from 'react';
import { CategoryManagementView } from './_components/CategoryManagementView';
import { CategoryItem, Question } from '@/types';
import { saveCategoriesToSpreadsheet } from '@/services/publicSheet';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        try {
          const storedCats = localStorage.getItem('quiz_custom_categories');
          if (storedCats) {
            setCategories(JSON.parse(storedCats));
          } else {
            const offlineRaw = localStorage.getItem('offline_public_db_cache');
            if (offlineRaw) {
              const parsed = JSON.parse(offlineRaw);
              if (parsed.categories) setCategories(parsed.categories);
            }
          }

          const storedQuestions = localStorage.getItem('quiz_custom_questions');
          if (storedQuestions) {
            setQuestions(JSON.parse(storedQuestions));
          } else {
            const offlineRaw = localStorage.getItem('offline_public_db_cache');
            if (offlineRaw) {
              const parsed = JSON.parse(offlineRaw);
              if (parsed.questions) setQuestions(parsed.questions);
            }
          }
        } catch (e) {
          console.warn('Failed to load categories from localStorage:', e);
        }
      });
    }
  }, []);

  const handleSaveCategories = async (newCategories: CategoryItem[]) => {
    setIsSyncing(true);
    setCategories(newCategories);
    try {
      await saveCategoriesToSpreadsheet(null, '', newCategories);
    } catch (e) {
      console.error('Failed to sync categories:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full pt-6 px-6 pb-12 bg-[#f7f9fb] min-h-screen">
      <CategoryManagementView
        categories={categories}
        questions={questions}
        onSaveCategories={handleSaveCategories}
        isSyncing={isSyncing}
      />
    </div>
  );
}
