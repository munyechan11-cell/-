const fs = require('fs');
const files = [
  'src/pages/customer/Login.tsx',
  'src/pages/customer/Scanner.tsx',
  'src/pages/customer/Dashboard.tsx',
  'src/pages/owner/Login.tsx',
  'src/pages/owner/Dashboard.tsx',
  'src/pages/owner/Customers.tsx',
  'src/pages/owner/Scanner.tsx',
  'src/pages/customer/TableEntry.tsx'
];

const replacements = {
  'bg-stone-100': 'bg-transparent',
  'bg-orange-600': 'bg-[#D84315]',
  'text-orange-600': 'text-[#D84315]',
  'border-orange-600': 'border-[#D84315]',
  'focus:border-orange-500': 'focus:border-[#D84315]',
  'bg-orange-700': 'bg-[#BF360C]',
  'hover:bg-orange-800': 'hover:bg-[#A02B0A]',
  'text-orange-100': 'text-[#FFF3E0]',
  'bg-orange-100': 'bg-[#FFF3E0]',
  'text-orange-800': 'text-[#D84315]',
  'bg-orange-50': 'bg-[#FFF3E0]/50',
  'border-orange-200': 'border-[#D84315]/20',
  'border-orange-500': 'border-[#D84315]',
  'text-orange-700': 'text-[#BF360C]',
  'bg-stone-800': 'bg-[#4E342E]',
  'text-stone-800': 'text-[#2D1B15]',
  'text-stone-500': 'text-[#795548]',
  'text-stone-400': 'text-[#A1887F]',
  'border-stone-200': 'border-[#E7E0D7]',
  'border-stone-100': 'border-[#E7E0D7]/50',
  'bg-stone-50': 'bg-[#F5F2EB]/50',
  'bg-stone-200': 'bg-[#EFEBE9]',
  'bg-stone-700': 'bg-[#3E2723]',
  'text-stone-700': 'text-[#4E342E]',
  'text-stone-600': 'text-[#5D4037]',
  'border-stone-800': 'border-[#4E342E]',
  'hover:bg-stone-900': 'hover:bg-[#3E2723]',
  'hover:bg-stone-600': 'hover:bg-[#5D4037]',
  'hover:text-stone-800': 'hover:text-[#2D1B15]',
  'hover:text-stone-600': 'hover:text-[#5D4037]',
  'text-stone-300': 'text-[#D7CCC8]',
  'border-stone-600': 'border-[#8D6E63]'
};

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
