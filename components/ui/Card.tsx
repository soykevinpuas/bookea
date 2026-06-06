interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'button' | 'a';
  onClick?: () => void;
  href?: string;
}

export default function Card({
  children,
  className = '',
  hover = true,
  as: Component = 'div',
  ...props
}: CardProps & Record<string, unknown>) {
  return (
    <Component
      className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm ${
        hover ? 'hover:shadow-md transition-shadow duration-200' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
