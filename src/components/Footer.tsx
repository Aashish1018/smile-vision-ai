const Footer = () => (
  <footer className="py-8 border-t border-border/60">
    <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="font-heading text-sm font-bold tracking-tight">
        Dental<span className="text-gradient">Vision</span>
      </span>
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} DentalVision Imaging. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
