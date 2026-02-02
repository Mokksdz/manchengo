'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, ChevronDown, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  isStockTracked?: boolean;
  defaultTvaRate?: number;
}

interface ProductMpComboboxProps {
  products: ProductMp[];
  value: number | null;
  onChange: (productId: number, product: ProductMp) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductMpCombobox({
  products,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Rechercher un article MP...',
  disabled = false,
  className,
}: ProductMpComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get selected product
  const selectedProduct = useMemo(() => 
    products.find(p => p.id === value), 
    [products, value]
  );

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const searchLower = search.toLowerCase();
    return products.filter(p => 
      p.code.toLowerCase().includes(searchLower) ||
      p.name.toLowerCase().includes(searchLower)
    );
  }, [products, search]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredProducts.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.querySelector('[data-highlighted="true"]');
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => 
          Math.min(i + 1, filteredProducts.length) // +1 for "Create new" option
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === filteredProducts.length) {
          // "Create new" option selected
          onCreateNew();
          setIsOpen(false);
          setSearch('');
        } else if (filteredProducts[highlightedIndex]) {
          const product = filteredProducts[highlightedIndex];
          onChange(product.id, product);
          setIsOpen(false);
          setSearch('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

  const handleSelect = (product: ProductMp) => {
    onChange(product.id, product);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateNew = () => {
    onCreateNew();
    setIsOpen(false);
    setSearch('');
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      RAW_MATERIAL: { label: 'MP', color: 'bg-blue-100 text-blue-700' },
      PACKAGING: { label: 'EMB', color: 'bg-orange-100 text-orange-700' },
      ADDITIVE: { label: 'ADD', color: 'bg-purple-100 text-purple-700' },
      CONSUMABLE: { label: 'CONSO', color: 'bg-[#F5F5F5] text-[#1D1D1F]' },
    };
    const badge = badges[category] || { label: category, color: 'bg-[#F5F5F5] text-[#1D1D1F]' };
    return (
      <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', badge.color)}>
        {badge.label}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input / Display */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors',
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-[#F0F0F0] hover:border-[#E5E5E5]',
          disabled && 'opacity-50 cursor-not-allowed bg-[#FAFAFA]'
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {isOpen ? (
          <>
            <Search className="w-4 h-4 text-[#AEAEB2] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 outline-none text-sm bg-transparent"
              autoFocus
            />
            {search && (
              <button
                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                className="p-0.5 hover:bg-[#F5F5F5] rounded"
              >
                <X className="w-3 h-3 text-[#AEAEB2]" />
              </button>
            )}
          </>
        ) : (
          <>
            <Package className="w-4 h-4 text-[#AEAEB2] flex-shrink-0" />
            {selectedProduct ? (
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-[#86868B]">{selectedProduct.code}</span>
                <span className="text-sm truncate">{selectedProduct.name}</span>
                <span className="text-xs text-[#AEAEB2]">({selectedProduct.unit})</span>
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#AEAEB2]">{placeholder}</span>
            )}
            <ChevronDown className="w-4 h-4 text-[#AEAEB2] flex-shrink-0" />
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#F0F0F0] rounded-lg shadow-apple-hover max-h-64 overflow-hidden">
          <div ref={listRef} className="overflow-y-auto max-h-52">
            {filteredProducts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#86868B] text-center">
                Aucun article trouvé
              </div>
            ) : (
              filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  data-highlighted={index === highlightedIndex}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                    index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-[#FAFAFA]'
                  )}
                  onClick={() => handleSelect(product)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="font-mono text-xs text-[#86868B] w-16">{product.code}</span>
                  <span className="flex-1 text-sm truncate">{product.name}</span>
                  {getCategoryBadge(product.category)}
                  <span className="text-xs text-[#AEAEB2] w-8 text-right">{product.unit}</span>
                </div>
              ))
            )}
          </div>
          
          {/* Create new option - always at bottom */}
          <div
            data-highlighted={highlightedIndex === filteredProducts.length}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 cursor-pointer border-t border-[#F0F0F0] transition-colors',
              highlightedIndex === filteredProducts.length 
                ? 'bg-green-50 text-green-700' 
                : 'hover:bg-green-50 text-green-600'
            )}
            onClick={handleCreateNew}
            onMouseEnter={() => setHighlightedIndex(filteredProducts.length)}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Créer un nouvel article MP</span>
          </div>
        </div>
      )}
    </div>
  );
}
