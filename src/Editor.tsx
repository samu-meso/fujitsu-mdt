import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Bold, Italic, List, ListOrdered, Link, Heading2, ImagePlus, Undo2 } from 'lucide-react'

export default function Editor({content,onChange,images}:{content:string;onChange:(html:string)=>void;images:{id:string;originalName:string;url:string}[]}) {
  const hydrated=images.reduce((html,image)=>html.replaceAll(`radiolog://attachment/${image.id}`,image.url),content)
  const editor=useEditor({extensions:[StarterKit,Image],content:hydrated,onUpdate:({editor})=>onChange(images.reduce((html,image)=>html.replaceAll(image.url,`radiolog://attachment/${image.id}`),editor.getHTML())),editorProps:{attributes:{'aria-label':'Contenuto del fascicolo',class:'document-editor'}}})
  if(!editor) return null
  return <div className="editor"><div className="editor-toolbar">
    <button type="button" title="Titolo" onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}><Heading2 size={17}/></button>
    <button type="button" title="Grassetto" onClick={()=>editor.chain().focus().toggleBold().run()}><Bold size={17}/></button>
    <button type="button" title="Corsivo" onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic size={17}/></button>
    <button type="button" title="Elenco puntato" onClick={()=>editor.chain().focus().toggleBulletList().run()}><List size={17}/></button>
    <button type="button" title="Elenco numerato" onClick={()=>editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17}/></button>
    <button type="button" title="Collegamento" onClick={()=>{const url=prompt('Indirizzo del collegamento (https://…)');if(url && /^https?:\/\//.test(url))editor.chain().focus().setLink({href:url}).run()}}><Link size={17}/></button>
    <button type="button" title="Annulla" onClick={()=>editor.chain().focus().undo().run()}><Undo2 size={17}/></button>
    {images.length>0 && <label className="image-select"><ImagePlus size={17}/><select aria-label="Inserisci un'immagine allegata" value="" onChange={e=>{if(e.target.value)editor.chain().focus().setImage({src:e.target.value}).run()}}><option value="">Inserisci immagine</option>{images.map(i=><option value={i.url} key={i.id}>{i.originalName}</option>)}</select></label>}
  </div><EditorContent editor={editor}/></div>
}
