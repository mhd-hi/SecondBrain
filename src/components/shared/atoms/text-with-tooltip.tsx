'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type TextWithTooltipProps = {
  text: string;
  className?: string;
  maxLines?: number;
  tooltipClassName?: string;
};

export const TruncatedTextWithTooltip = ({
  text,
  className = 'text-sm font-normal mt-1 line-clamp-4 leading-tight',
  maxLines = 4,
  tooltipClassName = 'max-w-xs whitespace-pre-wrap',
}: TextWithTooltipProps) => {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Check if text is truncated
  const checkIfTruncated = useCallback(() => {
    const element = textRef.current;
    if (element) {
      // Check if content is taller than maxLines
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      const maxHeight = lineHeight * maxLines;
      return element.scrollHeight > maxHeight;
    }
    return false;
  }, [maxLines]);

  useEffect(() => {
    setIsTruncated(checkIfTruncated());
  }, [text, checkIfTruncated]);

  const textElement = (
    <p
      ref={textRef}
      className={className}
    >
      {text}
    </p>
  );

  if (isTruncated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {textElement}
          </TooltipTrigger>
          <TooltipContent>
            <p className={tooltipClassName}>{text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return textElement;
};
