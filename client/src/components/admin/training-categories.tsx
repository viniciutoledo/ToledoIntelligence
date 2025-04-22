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
import { Pen, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";

const categoryFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function TrainingCategories() {
  const { t } = useLanguage();
  const {
    categories,
    categoriesLoading,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
  } = useTraining();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const addForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Reset form when opening the add dialog
  const handleAddDialogOpen = (open: boolean) => {
    if (!open) {
      addForm.reset();
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
  
  const onAddSubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(data);
    setIsAddDialogOpen(false);
  };
  
  const onEditSubmit = (data: CategoryFormValues) => {
    if (categoryToEdit) {
      updateCategoryMutation.mutate({
        id: categoryToEdit.id,
        name: data.name,
        description: data.description,
      });
    }
    
    setIsEditDialogOpen(false);
  };
  
  const handleEditCategory = (category: any) => {
    setCategoryToEdit(category);
    editForm.reset({
      name: category.name,
      description: category.description || "",
    });
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteCategory = (categoryId: number) => {
    deleteCategoryMutation.mutate(categoryId);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-800">
          {t("admin.training.categoriesList")}
        </h3>
        
        <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              {t("admin.training.addCategory")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("admin.training.newCategory")}</DialogTitle>
            </DialogHeader>
            
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.training.categoryName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("admin.training.enterCategoryName")} {...field} />
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
                      <FormLabel>{t("admin.training.categoryDescription")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("admin.training.enterCategoryDescription")}
                          {...field}
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
                  <Button type="submit" disabled={createCategoryMutation.isPending}>
                    {createCategoryMutation.isPending ? t("common.creating") : t("common.create")}
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
              <TableHead>{t("admin.training.description")}</TableHead>
              <TableHead>{t("admin.training.created")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoriesLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : categories && categories.length > 0 ? (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description}</TableCell>
                  <TableCell>
                    {format(new Date(category.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditCategory(category)}
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
                              {t("admin.training.confirmDeleteCategory")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.training.deleteCategoryWarning")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCategory(category.id)}
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
                <TableCell colSpan={4} className="text-center py-4">
                  {t("admin.training.noCategories")}
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
            <DialogTitle>{t("admin.training.editCategory")}</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.training.categoryName")}</FormLabel>
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
                    <FormLabel>{t("admin.training.categoryDescription")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
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
                <Button type="submit" disabled={updateCategoryMutation.isPending}>
                  {updateCategoryMutation.isPending
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