import React from 'react';
import { VscFile, VscJson } from 'react-icons/vsc';
import { DiJavascript1, DiReact, DiCss3, DiHtml5 } from 'react-icons/di';

export const getFileIcon = (filename = '') => {
  if (filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.cjs')) {
    return <DiJavascript1 className="w-[18px] h-[18px] text-[#f1e05a] mr-2 shrink-0" />;
  }
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx') || filename.endsWith('.ts')) {
    return <DiReact className="w-[18px] h-[18px] text-[#61dafb] mr-2 shrink-0" />;
  }
  if (filename.endsWith('.css') || filename.endsWith('.scss')) {
    return <DiCss3 className="w-[18px] h-[18px] text-[#563d7c] mr-2 shrink-0" />;
  }
  if (filename.endsWith('.html')) {
    return <DiHtml5 className="w-[18px] h-[18px] text-[#e34c26] mr-2 shrink-0" />;
  }
  if (filename.endsWith('.json')) {
    return <VscJson className="w-[18px] h-[18px] text-[#cb3837] mr-2 shrink-0" />;
  }
  return <VscFile className="w-[18px] h-[18px] text-[#cccccc] mr-2 shrink-0" />;
};
