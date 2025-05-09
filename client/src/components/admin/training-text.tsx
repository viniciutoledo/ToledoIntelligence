import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTraining, Document } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, MoreVertical, Check, ClipboardIcon, Edit, X, ImageIcon, Pencil } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function TrainingText() {
  // Estamos sobrescrevendo o hook de tradução para mostrar as chaves diretas
  const { i18n } = useTranslation();
  // Este é um hook fictício que apenas retorna a chave de tradução
  const t = (key: string) => key;
  const { 
    documents,
    documentsLoading,
    createTextDocumentMutation,
    deleteDocumentMutation,
    updateDocumentMutation,
    refetchDocuments
  } = useTraining();
  
  const [textContent, setTextContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para o modal de edição
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState<string | null>(null);
  const [editIsSubmitting, setEditIsSubmitting] = useState(false);
  
  // Estado para upload de imagem
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageDescription, setImageDescription] = useState<string>("");
  const [showImageDescription, setShowImageDescription] = useState<boolean>(false);
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const textDocuments = documents?.filter(doc => doc.document_type === "text") || [];
  
  const handleTextSubmit = async () => {
    // Permite o envio se houver texto OU imagem
    if (!textContent.trim() && !selectedImage) return;
    
    setIsSubmitting(true);
    console.log("Iniciando envio de conteúdo", { 
      hasText: !!textContent.trim(), 
      hasImage: !!selectedImage,
      imageName: selectedImage?.name 
    });
    
    try {
      // Prepara o FormData para suportar envio de imagem junto com o texto
      const formData = new FormData();
      const docName = selectedImage && !textContent.trim() 
        ? `Treinamento de imagem ${new Date().toLocaleString()}`
        : `Treinamento de texto ${new Date().toLocaleString()}`;
      
      formData.append('name', docName);
      formData.append('document_type', 'text');
      formData.append('content', textContent);
      
      if (selectedImage) {
        formData.append('file', selectedImage);
        
        // Adiciona a descrição da imagem (se existir)
        if (imageDescription.trim()) {
          formData.append('description', imageDescription);
        }
      }
      
      // Usar a mutation genérica que suporta FormData
      await fetch("/api/training/documents", {
        method: "POST",
        body: formData,
        credentials: "include"
      }).then(res => {
        if (!res.ok) {
          throw new Error("Falha ao criar documento de texto");
        }
        return res.json();
      });
      
      // Recarregar a lista de documentos usando a função refetchDocuments
      await refetchDocuments();
      
      // Limpar o formulário
      setTextContent("");
      setSelectedImage(null);
      setImageDescription("");
      setShowImageDescription(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting text:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    try {
      await deleteDocumentMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setShowImageDescription(true);
    }
  };
  
  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (doc: Document) => {
    setEditingDocument(doc);
    setEditContent(doc.content || "");
    setEditName(doc.name);
    setEditDescription(doc.description);
    
    // Se tiver imagem, pré-carrega
    if (doc.image_url) {
      setImagePreview(doc.image_url);
    } else {
      setImagePreview(null);
    }
    
    setEditSelectedImage(null);
  };
  
  const closeEditModal = () => {
    setEditingDocument(null);
    setEditContent("");
    setEditName("");
    setEditDescription(null);
    setImagePreview(null);
    setEditSelectedImage(null);
    setIsEditingImage(false);
  };
  
  const handleSaveDocument = async () => {
    if (!editingDocument) return;
    
    setEditIsSubmitting(true);
    
    try {
      if (editSelectedImage) {
        // Usar FormData para envio com arquivo
        const formData = new FormData();
        formData.append('name', editName);
        if (editDescription !== null) {
          formData.append('description', editDescription);
        }
        formData.append('content', editContent);
        formData.append('file', editSelectedImage);
        
        await fetch(`/api/training/documents/${editingDocument.id}`, {
          method: "PATCH",
          body: formData,
          credentials: "include"
        }).then(res => {
          if (!res.ok) {
            throw new Error("Falha ao atualizar documento com imagem");
          }
          return res.json();
        });
      } else {
        // Atualização sem imagem
        await updateDocumentMutation.mutateAsync({
          id: editingDocument.id,
          document: {
            name: editName,
            description: editDescription,
            content: editContent
          }
        });
      }
      
      closeEditModal();
    } catch (error) {
      console.error("Error updating document:", error);
    } finally {
      setEditIsSubmitting(false);
    }
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return format(
      dateObj,
      "d MMM yyyy, HH:mm",
      { locale: i18n.language === 'pt' ? ptBR : enUS }
    );
  };
  
  return (
    <div>
      {/* Cabeçalho do novo treinamento */}
      <div className="flex items-center mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <h3 className="ml-2 text-base font-medium">Novo Treinamento (Texto e/ou Imagem)</h3>
      </div>

      {/* Área de input do texto */}
      <div className="mb-6 rounded-lg border bg-card">
        <div className="p-4">
          <Textarea
            placeholder="Digite o conteúdo de texto para treinar o modelo de IA (opcional se uma imagem for adicionada)..."
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-sm ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        
        {/* Upload de imagem */}
        <div className="px-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              className="h-8"
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              {selectedImage ? "Alterar imagem" : "Adicionar imagem"}
            </Button>
            
            {selectedImage && (
              <>
                <span className="text-xs text-muted-foreground">
                  {selectedImage.name} ({Math.round(selectedImage.size / 1024)} KB)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedImage(null);
                    setShowImageDescription(false);
                    setImageDescription("");
                    if (imageInputRef.current) {
                      imageInputRef.current.value = "";
                    }
                  }}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          
          {/* Campo de descrição para a imagem */}
          {showImageDescription && selectedImage && (
            <div className="mt-2">
              <Label htmlFor="image-description" className="text-xs mb-1 block">
                Descrição da imagem (opcional)
              </Label>
              <Textarea
                id="image-description"
                placeholder="Adicione uma descrição sobre a imagem para orientar o LLM durante o treinamento..."
                value={imageDescription}
                onChange={e => setImageDescription(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A descrição ajuda o modelo a entender melhor o contexto da imagem.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Digite texto e/ou adicione uma imagem para treinamento</span>
          </div>
          <Button
            type="button" 
            onClick={handleTextSubmit}
            disabled={isSubmitting || (!textContent.trim() && !selectedImage)}
            size="sm"
            className="h-8"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </span>
            ) : (
              selectedImage ? "Enviar Imagem" : "Enviar Texto"
            )}
          </Button>
        </div>
      </div>
      
      {/* Lista de documentos de treinamento */}
      <div className="space-y-2">
        {documentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : textDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Nenhum Item de Treinamento</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Adicione texto ou imagens para treinar o modelo de IA
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-medium mb-2">Itens de Treinamento</h3>
            <div className="space-y-2">
              {textDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1 mr-4">
                      <div className="line-clamp-2 text-sm">
                        {doc.content}
                      </div>
                      <div className="mt-1 flex items-center text-xs text-muted-foreground">
                        <span>Item de Treinamento</span>
                        {doc.image_url && (
                          <span className="ml-2 flex items-center text-emerald-600">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Com imagem
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col gap-1">
                        <Badge className={`px-2 py-0.5 text-xs ${
                          doc.status === 'completed' || doc.status === 'indexed'
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : doc.status === 'processing'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : doc.status === 'error'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {(doc.status === 'completed' || doc.status === 'indexed') && <Check className="mr-1 h-3 w-3" />}
                          {doc.status === 'completed' ? 'Concluído' : 
                           doc.status === 'indexed' ? 'Treinado' :
                           doc.status === 'processing' ? 'Processando' : 
                           doc.status === 'error' ? 'Erro' : 'Pendente'}
                        </Badge>
                        
                        {/* Barra de progresso para documentos em processamento */}
                        {doc.status === 'processing' && (
                          <div className="w-full mt-1">
                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${doc.progress || 0}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 text-right">{doc.progress || 0}%</div>
                          </div>
                        )}
                        
                        {/* Mensagem para documentos pendentes */}
                        {doc.status === 'pending' && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Aguardando processamento...
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center"
                            onClick={() => navigator.clipboard.writeText(doc.content || '')}
                          >
                            <ClipboardIcon className="mr-2 h-4 w-4" />
                            <span>Copiar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center"
                            onClick={() => openEditModal(doc)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="flex cursor-pointer items-center text-red-600 focus:text-red-600" 
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Modal de Edição */}
      {editingDocument && (
        <Dialog open={!!editingDocument} onOpenChange={(open) => !open && closeEditModal()}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Item de Treinamento</DialogTitle>
              <DialogDescription>
                Edite o conteúdo de texto e/ou imagem usados para treinar o modelo de IA.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="content" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="image">Imagem</TabsTrigger>
              </TabsList>
              
              {/* Tab de Detalhes */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="edit_name">Nome do Documento</Label>
                  <Input
                    id="edit_name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit_description">Descrição</Label>
                  <Textarea
                    id="edit_description"
                    placeholder="Digite uma descrição para o documento (opcional)"
                    value={editDescription || ""}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 resize-none min-h-[100px]"
                  />
                </div>
                
                <div>
                  <Label className="block mb-2">Status</Label>
                  <Badge className={`px-2 py-1 text-xs ${
                    editingDocument.status === 'completed' || editingDocument.status === 'indexed'
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : editingDocument.status === 'processing'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : editingDocument.status === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {(editingDocument.status === 'completed' || editingDocument.status === 'indexed') && <Check className="mr-1 h-3 w-3 inline" />}
                    {editingDocument.status === 'completed' ? 'Concluído' : 
                     editingDocument.status === 'indexed' ? 'Treinado' :
                     editingDocument.status === 'processing' ? 'Processando' : 
                     editingDocument.status === 'error' ? 'Erro' : 'Pendente'}
                  </Badge>
                </div>
              </TabsContent>
              
              {/* Tab de Conteúdo */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="edit_content">Conteúdo do Texto</Label>
                  <Textarea
                    id="edit_content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="mt-1 min-h-[300px] resize-y font-mono text-sm"
                  />
                </div>
              </TabsContent>
              
              {/* Tab de Imagem */}
              <TabsContent value="image" className="space-y-4 mt-4">
                <div className="border rounded-md p-4">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <div className="relative aspect-video w-full overflow-hidden rounded-md">
                        <img 
                          src={imagePreview} 
                          alt="Preview da imagem" 
                          className="object-contain w-full h-full"
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setImagePreview(null);
                            setEditSelectedImage(null);
                            if (imageInputRef.current) {
                              imageInputRef.current.value = "";
                            }
                          }}
                        >
                          <X className="h-4 w-4 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-8 cursor-pointer"
                      onClick={() => {
                        setIsEditingImage(true);
                        imageInputRef.current?.click();
                      }}
                    >
                      <div className="rounded-full bg-primary/10 p-3 mb-3">
                        <ImageIcon className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Clique para adicionar uma imagem ilustrativa
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Formatos suportados: JPG, PNG, GIF (máx. 5MB)
                      </p>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="image/*"
                    ref={imageInputRef}
                    onChange={handleEditImageChange}
                    className="hidden"
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={closeEditModal}
                disabled={editIsSubmitting}
              >
                Cancelar
              </Button>
              
              <Button 
                type="button" 
                onClick={handleSaveDocument}
                disabled={editIsSubmitting}
              >
                {editIsSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}