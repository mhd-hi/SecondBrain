import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils/colors-util';

export type BannerProps = {
  icon?: React.ElementType;
  message: string;
  description?: string;
  variant?: 'default' | 'destructive';
  iconClassName?: string;
  textClassName?: string;
  alertClassName?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function Banner({
  icon: Icon,
  message,
  description,
  variant = 'default',
  iconClassName,
  textClassName,
  alertClassName,
  actions,
  className,
}: BannerProps) {
  return (
    <Alert variant={variant} className={cn('mb-6', alertClassName, className)}>
      <AlertDescription>
        <div className="flex w-full flex-wrap items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={iconClassName} />}
            <span className={textClassName}><strong>{message}</strong></span>
          </div>
          {actions && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {actions}
            </div>
          )}
        </div>
        {description && (
          <p className={cn('opacity-80 whitespace-pre-line', textClassName)}>
            {description}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
