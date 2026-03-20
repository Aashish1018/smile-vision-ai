import { motion } from "framer-motion";
import { Scan, Box, Activity, Brain } from "lucide-react";

const services = [
  {
    icon: Scan,
    title: "Panoramic X-Ray",
    description: "Full jaw imaging with crystal-clear detail for comprehensive diagnostics and treatment planning.",
  },
  {
    icon: Box,
    title: "3D CBCT Imaging",
    description: "Cone beam computed tomography delivering volumetric 3D data for implants, ortho, and surgery.",
  },
  {
    icon: Activity,
    title: "Cephalometric Analysis",
    description: "Precise lateral and frontal skull measurements for orthodontic treatment planning.",
  },
  {
    icon: Brain,
    title: "AI Diagnostics",
    description: "Machine learning-enhanced analysis that detects pathology with unparalleled accuracy.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15 },
  }),
};

const Services = () => {
  return (
    <section id="services" className="py-24 bg-surface">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Our Services</span>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mt-3 mb-4">
            Complete imaging <span className="text-gradient">solutions</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            State-of-the-art digital radiography covering every diagnostic need in modern dental practice.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="group relative p-6 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:glow-sm transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <service.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">{service.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
