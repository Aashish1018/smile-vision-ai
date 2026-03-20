import { motion } from "framer-motion";
import dentalXray from "@/assets/dental-xray.jpg";
import clinicInterior from "@/assets/clinic-interior.jpg";

const stats = [
  { value: "0.08mm", label: "Voxel Resolution" },
  { value: "<3s", label: "Scan Time" },
  { value: "70%", label: "Less Radiation" },
  { value: "99.4%", label: "Diagnostic Accuracy" },
];

const Technology = () => {
  return (
    <section id="technology" className="py-24">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Technology</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold mt-3 mb-6">
              Imaging at the <span className="text-gradient">frontier</span>
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Our systems combine ultra-high-resolution sensors with proprietary reconstruction algorithms, delivering diagnostic images that redefine what's possible in dental radiology.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="p-4 rounded-lg bg-surface border border-border/60">
                  <div className="text-2xl font-heading font-bold text-gradient">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden glow-md">
              <img src={dentalXray} alt="Dental X-ray on monitor" className="w-full rounded-2xl" />
            </div>
            <div className="absolute -bottom-6 -left-6 w-40 h-28 rounded-xl overflow-hidden border-4 border-background shadow-xl">
              <img src={clinicInterior} alt="Modern dental clinic" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Technology;
