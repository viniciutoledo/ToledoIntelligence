import { useState } from "react";
import { useTraining } from "@/hooks/use-training";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FileText,
  Globe,
  Pen,
  PlusCircle,
  RefreshCw,
  Trash2,
  Image,
  MoreVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const documentFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().nullable().optional(),
  document_type: z.enum(["text", "file", "website", "image"]),
  content: z.string().optional(),
  website_url: z.string().url().optional(),
  categories: z.array(z.number()).optional(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

// Estendendo o tipo para incluir os arquivos
interface DocumentFormData extends DocumentFormValues {
  file?: File;
  image?: File;
}

export function TrainingDocuments() {
  const { t } = useLanguage();
  const {
    documents,
    documentsLoading,
    categories,
    createDocumentMutation,
    createImageDocumentMutation,
    updateDocumentMutation,
    deleteDocumentMutation,
    resetDocumentStatusMutation,
  } = useTraining();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [documentForImage, setDocumentForImage] = useState<any | null>(null);
  
  const addForm = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: "",
      description: null,
      document_type: "text",
      content: "",
      categories: [],
    },
  });
  
  const editForm = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: "",
      description: null,
      document_type: "text", // necessário para evitar tipo indefinido
    },
  });
  
  // Reset form when opening the add dialog
  const handleAddDialogOpen = (open: boolean) => {
    if (!open) {
      addForm.reset();
      setSelectedFile(null);
      setSelectedImage(null);
    }
    setIsAddDialogOpen(open);
  };
  
  // Reset form when opening the edit dialog
  const handleEditDialogOpen = (open: boolean) => {
    if (!open) {
      editForm.reset();
    }
    setIsEditDialogOpen(open);
  };
  
  // Função para lidar com diferentes tipos de documentos
  const handleAddDocumentType = (type: "text" | "file" | "website" | "image") => {
    addForm.setValue("document_type", type);
    setIsAddDialogOpen(true);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };
  
  const onAddSubmit = (data: DocumentFormValues) => {
    // Manipulação específica para tipo "image"
    if (data.document_type === "image" && selectedImage) {
      // Usar a mutation específica para imagens
      createImageDocumentMutation.mutate({
        name: data.name,
        description: data.description || null,
        image: selectedImage
      });
      setIsAddDialogOpen(false);
      return;
    }
    
    // Objeto base para submissão para outros tipos
    const submitData: any = {
      ...data,
      description: data.description || null
    };
    
    // Handle file upload
    if (data.document_type === "file" && selectedFile) {
      submitData.file = selectedFile;
    }
    
    // Handle de upload de imagem para texto
    if (data.document_type === "text" && selectedImage) {
      submitData.image = selectedImage;
    }
    
    createDocumentMutation.mutate(submitData);
    setIsAddDialogOpen(false);
  };
  
  const onEditSubmit = (data: DocumentFormValues) => {
    if (documentToEdit) {
      // Use any para permitir a inclusão de campos adicionais não presentes no tipo DocumentFormData
      const updateData: any = {
        name: data.name,
        description: data.description || null,
      };
      
      // Adiciona campos específicos baseados no tipo de documento
      if (data.document_type === 'text' && data.content) {
        updateData.content = data.content;
      } else if (data.document_type === 'website' && data.website_url) {
        updateData.website_url = data.website_url;
      }
      
      // Adiciona reset de status para documentos presos em "processing"
      if (documentToEdit.status === 'processing') {
        updateData.status = 'pending';
        updateData.error_message = null;
      }
      
      updateDocumentMutation.mutate({
        id: documentToEdit.id,
        document: updateData
      });
    }
    
    setIsEditDialogOpen(false);
  };
  
  const handleEditDocument = (document: any) => {
    setDocumentToEdit(document);
    
    // Prepara os valores iniciais do formulário com base no tipo de documento
    const defaultValues: any = {
      name: document.name,
      description: document.description || null,
      document_type: document.document_type || "text",
    };
    
    // Adiciona campos específicos com base no tipo de documento
    if (document.document_type === 'text') {
      defaultValues.content = document.content || '';
    } else if (document.document_type === 'website') {
      defaultValues.website_url = document.website_url || '';
    }
    
    editForm.reset(defaultValues);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteDocument = (documentId: number) => {
    deleteDocumentMutation.mutate(documentId);
  };
  
  const handleResetDocumentStatus = (documentId: number) => {
    resetDocumentStatusMutation.mutate(documentId);
  };
  
  const handleAddImage = (document: any) => {
    setDocumentForImage(document);
    setIsImageDialogOpen(true);
  };
  
  const handleImageDialogOpen = (open: boolean) => {
    if (!open) {
      setSelectedImage(null);
    }
    setIsImageDialogOpen(open);
  };
  
  const handleImageSubmit = () => {
    if (documentForImage && selectedImage) {
      // Criar um objeto de atualização com a imagem
      const updateData: any = {
        name: documentForImage.name,
        description: documentForImage.description || null,
        image: selectedImage
      };
      
      // Chamar a API para adicionar a imagem
      updateDocumentMutation.mutate({
        id: documentForImage.id,
        document: updateData
      });
      
      setIsImageDialogOpen(false);
    }
  };
  
  // Função específica para editar apenas o texto do documento
  const handleEditText = (document: any) => {
    if (document.document_type === 'text') {
      setDocumentToEdit(document);
      
      const defaultValues: any = {
        name: document.name,
        description: document.description || null,
        document_type: "text",
        content: document.content || "",
      };
      
      editForm.reset(defaultValues);
      setIsEditDialogOpen(true);
    }
  };
  
  const getStatusBadge = (status: string, document?: any) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.pending")}
          </Badge>
        );
      case "processing":
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              <CircleDashed className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.processing")} {document?.progress ? `(${document.progress}%)` : ''}
            </Badge>
            {document?.progress !== null && document?.progress !== undefined && (
              <div className="w-full">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${document.progress || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CircleCheck className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.completed")}
          </Badge>
        );
      case "indexed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <CircleCheck className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.indexed") || "Treinado"}
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <CircleX className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.error")}
          </Badge>
        );
      default:
        return null;
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <FileText className="h-4 w-4 mr-1" />;
      case "file":
        return <FileText className="h-4 w-4 mr-1" />;
      case "website":
        return <Globe className="h-4 w-4 mr-1" />;
      case "image":
        return <Image className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-800">
          {t("admin.training.documentsList")}
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Botão para adicionar texto */}
          <Button variant="outline" onClick={() => handleAddDocumentType("text")}>
            <FileText className="h-4 w-4 mr-2" />
            Texto
          </Button>
          
          {/* Botão para adicionar imagem */}
          <Button variant="outline" onClick={() => handleAddDocumentType("image")}>
            <Image className="h-4 w-4 mr-2" />
            Imagem
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                {t("admin.training.addDocument")}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>{t("admin.training.newDocument")}</DialogTitle>
            </DialogHeader>
            
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.training.documentName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("admin.training.enterDocumentName")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.training.documentDescription")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("admin.training.enterDocumentDescription")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="document_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.training.documentType")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("admin.training.selectDocumentType")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text">{t("admin.training.textType")}</SelectItem>
                          <SelectItem value="file">{t("admin.training.fileType")}</SelectItem>
                          <SelectItem value="website">{t("admin.training.websiteType")}</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {addForm.watch("document_type") === "text" && (
                  <>
                    <FormField
                      control={addForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.training.textContent")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("admin.training.enterTextContent")}
                              className="min-h-[200px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormItem>
                      <FormLabel>Adicionar Imagem (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          onChange={handleImageChange}
                          accept=".jpg,.jpeg,.png"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </>
                )}
                
                {addForm.watch("document_type") === "file" && (
                  <FormItem>
                    <FormLabel>{t("admin.training.fileUpload")}</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
                
                {addForm.watch("document_type") === "website" && (
                  <FormField
                    control={addForm.control}
                    name="website_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin.training.websiteUrl")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {addForm.watch("document_type") === "image" && (
                  <FormItem>
                    <FormLabel>Upload de Imagem</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        onChange={handleImageChange}
                        accept=".jpg,.jpeg,.png"
                      />
                    </FormControl>
                    <FormDescription>
                      Selecione uma imagem para análise e treinamento (JPG, PNG)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
                
                {categories && categories.length > 0 && (
                  <FormField
                    control={addForm.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin.training.categories")}</FormLabel>
                        <FormControl>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder={t("admin.training.selectCategories")} />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={createDocumentMutation.isPending}>
                    {createDocumentMutation.isPending ? t("common.creating") : t("common.create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.training.name")}</TableHead>
              <TableHead>{t("admin.training.type")}</TableHead>
              <TableHead>{t("admin.training.statusLabel")}</TableHead>
              <TableHead>{t("admin.training.created")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentsLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : documents && documents.length > 0 ? (
              documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getTypeIcon(document.document_type)}
                      {t(`admin.training.${document.document_type}Type`)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(document.status, document)}</TableCell>
                  <TableCell>
                    {format(new Date(document.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      {/* Botão para resetar status de documentos com problemas */}
                      {(document.status === 'error' || document.status === 'pending' || document.status === 'processing') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-500"
                          onClick={() => handleResetDocumentStatus(document.id)}
                          disabled={resetDocumentStatusMutation.isPending}
                          title={t("admin.training.resetStatus")}
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">{t("admin.training.resetStatus")}</span>
                        </Button>
                      )}
                      
                      {/* Botões para documentos do tipo texto */}
                      {document.document_type === 'text' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleEditText(document)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Editar texto
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-indigo-600 border-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            onClick={() => handleAddImage(document)}
                          >
                            <Image className="h-4 w-4 mr-1" />
                            Adicionar imagem
                          </Button>
                        </>
                      )}
                      
                      {/* Botão para editar documento padrão */}
                      {document.document_type !== 'text' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEditDocument(document)}
                        >
                          <Pen className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      )}
                      
                      {/* Botão para excluir documento */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteDocument(document.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  {t("admin.training.noDocuments")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{t("admin.training.editDocument")}</DialogTitle>
            {documentToEdit?.status === 'processing' && (
              <DialogDescription className="text-amber-600">
                Este documento está sendo processado. Editar e salvar irá resetar seu status para permitir reprocessamento.
              </DialogDescription>
            )}
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.training.documentName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.training.documentDescription")}</FormLabel>
                    <FormControl>
                      <Textarea 
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campos condicionais com base no tipo de documento */}
              {editForm.watch("document_type") === "text" && (
                <>
                  <FormField
                    control={editForm.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin.training.textContent")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("admin.training.enterTextContent")}
                            className="min-h-[200px]"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                
                  <FormItem>
                    <FormLabel>Imagem associada (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        onChange={handleImageChange}
                        accept=".jpg,.jpeg,.png"
                      />
                    </FormControl>
                    <div className="text-sm text-gray-500 mt-1">
                      {documentToEdit?.image_url ? (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-1">Imagem atual:</p>
                          <img 
                            src={documentToEdit.image_url} 
                            alt="Imagem atual" 
                            className="max-h-[200px] rounded border border-gray-200"
                          />
                        </div>
                      ) : (
                        "Adicione uma imagem ao documento se necessário"
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                </>
              )}
              
              {editForm.watch("document_type") === "website" && (
                <FormField
                  control={editForm.control}
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.training.websiteUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateDocumentMutation.isPending}>
                  {updateDocumentMutation.isPending
                    ? t("common.saving")
                    : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para adicionar imagem a um documento existente */}
      <Dialog open={isImageDialogOpen} onOpenChange={handleImageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar imagem ao documento</DialogTitle>
            <DialogDescription>
              {documentForImage?.name ? (
                <span>Adicione uma imagem ao documento: <strong>{documentForImage.name}</strong></span>
              ) : (
                "Selecione uma imagem para adicionar ao documento"
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <FormLabel htmlFor="image-upload">Selecione uma imagem</FormLabel>
              <Input
                id="image-upload"
                type="file"
                onChange={handleImageChange}
                accept=".jpg,.jpeg,.png"
              />
              <p className="text-sm text-muted-foreground">
                Formatos suportados: JPG, PNG
              </p>
            </div>
            
            {selectedImage && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Arquivo selecionado:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedImage.name} ({Math.round(selectedImage.size / 1024)} KB)
                </p>
              </div>
            )}
            
            {documentForImage?.image_url && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Imagem atual:</p>
                <img
                  src={documentForImage.image_url}
                  alt="Imagem atual"
                  className="max-h-[200px] rounded border border-gray-200"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button 
              onClick={handleImageSubmit} 
              disabled={!selectedImage || updateDocumentMutation.isPending}
            >
              {updateDocumentMutation.isPending 
                ? "Salvando..." 
                : "Salvar imagem"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}