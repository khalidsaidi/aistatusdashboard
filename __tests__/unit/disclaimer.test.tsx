import { render, screen } from '@testing-library/react';
import Footer from '@/app/components/Footer';

describe('Disclaimer and Trademark Compliance', () => {
  it('should display reference-only disclaimer', () => {
    render(<Footer />);
    
    expect(screen.getByText(/for reference only/i)).toBeInTheDocument();
    expect(screen.getByText(/no responsibility/i)).toBeInTheDocument();
  });

  it('should display trademark attribution', () => {
    render(<Footer />);
    
    expect(screen.getByText(/all trademarks and logos are the property of their respective owners/i)).toBeInTheDocument();
    expect(screen.getByText(/used here for identification purposes only/i)).toBeInTheDocument();
  });

  it('should display removal clause', () => {
    render(<Footer />);
    
    expect(screen.getByText(/rights holder/i)).toBeInTheDocument();
    expect(screen.getByText(/contact/i)).toBeInTheDocument();
    expect(screen.getByText(/24.*h/i)).toBeInTheDocument();
  });

  it('should have contact email for trademark removal', () => {
    render(<Footer />);
    
    const contactLink = screen.getByRole('link', { name: /contact/i });
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });

  it('should be positioned at bottom of page', () => {
    render(<Footer />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });
}); 