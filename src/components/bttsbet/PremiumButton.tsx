'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { buttonHover } from '@/lib/motionPresets'
import { trackAffiliateAction } from '@/lib/affiliateTracking'

type Variant = 'linebet' | 'star888' | 'gold' | 'ghost' | 'download'
type Size = 'sm' | 'md' | 'lg'

interface PremiumButtonProps extends Omit<HTMLMotionProps<'a'>, 'ref'> {
  variant?: Variant
  size?: Size
  href: string
  children?: React.ReactNode
  showLogo?: boolean
  downloadText?: string
  fullWidth?: boolean
  trackingPlacement?: string
}

const SIZES: Record<Size, string> = {
  sm: 'px-4 py-2.5 text-[13px] gap-1.5',
  md: 'px-5 py-2.5 sm:px-6 sm:py-3 text-sm gap-2',
  lg: 'px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base gap-2.5',
}

const VARIANTS: Record<Variant, {
  className: string
  logo?: string
  logoAlt?: string
  logoClass?: string
}> = {
  linebet: {
    className: 'btn-linebet cta-glow text-[#FFFFFF] font-semibold',
    logo: '/logos/linebet-provided.jpg',
    logoAlt: 'Linebet',
    logoClass: 'h-4 sm:h-5 w-auto',
  },
  star888: {
    className: 'btn-star888 cta-glow text-[#E8C268] font-semibold',
    logo: '/logos/888starz-provided.webp',
    logoAlt: '888starz',
    logoClass: 'h-4 sm:h-5 w-auto',
  },
  gold: {
    className: 'btn-gold cta-glow text-[#FFFFFF] font-semibold',
  },
  ghost: {
    className: 'btn-ghost font-semibold',
  },
  download: {
    className: 'btn-gold cta-glow text-[#FFFFFF] font-semibold',
    logo: '/logos/google-play.svg',
    logoAlt: 'Google Play',
    logoClass: 'h-4 sm:h-5 w-4 sm:w-5',
  },
}

export default function PremiumButton({
  variant = 'linebet',
  size = 'md',
  href,
  children,
  showLogo = true,
  fullWidth = false,
  trackingPlacement,
  className = '',
  onClick,
  ...rest
}: PremiumButtonProps) {
  const v = VARIANTS[variant]
  const sizeClass = SIZES[size]
  const partner = variant === 'star888' ? '888starz' : 'linebet'
  const action = variant === 'download' ? 'download_click' : 'signup_cta_click'

  return (
    <motion.a
      variants={buttonHover}
      whileHover="hover"
      whileTap="tap"
      href={href}
      rel="sponsored nofollow noopener noreferrer"
      target="_blank"
      onClick={(event) => {
        trackAffiliateAction(partner, action, trackingPlacement || `premium-button-${variant}`)
        onClick?.(event)
      }}
      className={`inline-flex items-center justify-center rounded-xl ${sizeClass} ${v.className} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {showLogo && v.logo && (
        <img
          src={v.logo}
          alt={v.logoAlt || ''}
          className={v.logoClass || 'h-4 w-auto'}
          loading="lazy"
        />
      )}
      {children && <span className="truncate">{children}</span>}
    </motion.a>
  )
}

// Compound convenience components
export function LinebetButton({ children = 'S\'inscrire sur Linebet', ...props }: Omit<PremiumButtonProps, 'variant' | 'href'> & { href: string }) {
  return <PremiumButton variant="linebet" {...props}>{children}</PremiumButton>
}

export function Star888Button({ children = 'S\'inscrire sur 888starz', ...props }: Omit<PremiumButtonProps, 'variant' | 'href'> & { href: string }) {
  return <PremiumButton variant="star888" {...props}>{children}</PremiumButton>
}

export function DownloadButton({ children = 'Télécharger l\'app', ...props }: Omit<PremiumButtonProps, 'variant' | 'href'> & { href: string }) {
  return <PremiumButton variant="download" {...props}>{children}</PremiumButton>
}
