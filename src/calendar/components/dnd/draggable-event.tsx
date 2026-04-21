'use client';

import type { TEvent } from '@/calendar/types';
import { useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';

import { getEmptyImage } from 'react-dnd-html5-backend';

import { ItemTypes } from '@/calendar/components/dnd/item-types';
import { cn } from '@/lib/utils/colors-util';

type DraggableEventProps = {
  event: TEvent;
  children: React.ReactNode;
};

export function DraggableEvent({ event, children }: DraggableEventProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.EVENT,
    item: () => {
      const width = ref.current?.offsetWidth || 0;
      const height = ref.current?.offsetHeight || 0;
      return { event, children, width, height };
    },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  }));

  // Hide the default drag preview
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  drag(ref);

  return (
    <div ref={ref} className={cn(isDragging && 'opacity-40')}>
      {children}
    </div>
  );
}
