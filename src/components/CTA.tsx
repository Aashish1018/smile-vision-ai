import { motion } from "framer-motion";
import { ArrowRight, MapPin, Clock, Phone as PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section id="contact" className="py-24 bg-surface">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-accent p-12 md:p-16 text-center"
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,_white_0%,_transparent_60%)]" />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-primary-foreground mb-4">
              Ready for clarity?
            </h2>
            <p className="text-primary-foreground/80 max-w-md mx-auto mb-8">
              Schedule your imaging appointment today. Same-day results with our digital workflow.
            </p>
            <Button size="lg" variant="secondary" className="gap-2 text-sm font-semibold">
              Book Your Appointment <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            { icon: MapPin, title: "Location", info: "123 Medical Plaza, Suite 400" },
            { icon: Clock, title: "Hours", info: "Mon–Fri: 8AM – 6PM" },
            { icon: PhoneIcon, title: "Contact", info: "(555) 234-5678" },
          ].map(({ icon: Icon, title, info }) => (
            <div key={title} className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border/60">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{title}</div>
                <div className="text-sm font-medium">{info}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CTA;
