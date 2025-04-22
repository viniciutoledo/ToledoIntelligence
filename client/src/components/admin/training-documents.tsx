import { useState } from "react";
import { useTraining } from "@/hooks/use-training";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FileText,
  Globe,
  Pen,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const documentFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().nullable().optional(),
  document_type: z.enum(["text", "file", "website"]),
  content: z.string().optional(),
  website_url: z.string().url().optional(),
  categories: z.array(z.number()).optional(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

// Estendendo o tipo para incluir o arquivo
interface DocumentFormData extends DocumentFormValues {
  file?: File;
}

export function TrainingDocuments() {
  const { t } = useLanguage();
  const {
    documents,
    documentsLoading,
    categories,
    createDocumentMutation,
    updateDocumentMutation,
    deleteDocumentMutation,
  } = useTraining();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  const onAddSubmit = (data: DocumentFormValues) => {
    // Handle file upload
    if (data.document_type === "file" && selectedFile) {
      const documentData: DocumentFormData = {
        ...data,
        file: selectedFile,
      };
      createDocumentMutation.mutate(documentData);
    } else {
      createDocumentMutation.mutate(data);
    }
    
    setIsAddDialogOpen(false);
  };
  
  const onEditSubmit = (data: DocumentFormValues) => {
    if (documentToEdit) {
      updateDocumentMutation.mutate({
        id: documentToEdit.id,
        document: {
          name: data.name,
          description: data.description,
        }
      });
    }
    
    setIsEditDialogOpen(false);
  };
  
  const handleEditDocument = (document: any) => {
    setDocumentToEdit(document);
    editForm.reset({
      name: document.name,
      description: document.description || null,
      document_type: document.document_type || "text",
    });
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteDocument = (documentId: number) => {
    deleteDocumentMutation.mutate(documentId);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.pending")}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <CircleDashed className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.processing")}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CircleCheck className="h-3 w-3 mr-1" /> {t("admin.training.statusTypes.completed")}
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {addForm.watch("document_type") === "text" && (
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
                  <TableCell>{getStatusBadge(document.status)}</TableCell>
                  <TableCell>
                    {format(new Date(document.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditDocument(document)}
                      >
                        <Pen className="h-4 w-4" />
                        <span className="sr-only">{t("common.edit")}</span>
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t("common.delete")}</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("admin.training.confirmDelete")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.training.deleteWarning")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDocument(document.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("admin.training.editDocument")}</DialogTitle>
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
    </div>
  );
}