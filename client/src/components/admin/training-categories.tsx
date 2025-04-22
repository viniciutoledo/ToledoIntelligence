import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining, type CategoryFormData } from "@/hooks/use-training";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pen, PlusCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Form validation schema
const categoryFormSchema = z.object({
  name: z.string().min(2, 'admin.training.nameValidation'),
  description: z.string().nullable().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function TrainingCategories() {
  const { t } = useTranslation();
  const {
    categories,
    categoriesLoading,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
  } = useTraining();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<CategoryFormData | null>(null);

  // Add form
  const addForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Edit form
  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleAddDialogOpen = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      addForm.reset();
    }
  };

  const handleEditDialogOpen = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      editForm.reset();
      setCurrentCategory(null);
    }
  };

  const onAddSubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(data, {
      onSuccess: () => {
        handleAddDialogOpen(false);
      },
    });
  };

  const onEditSubmit = (data: CategoryFormValues) => {
    if (currentCategory?.id) {
      updateCategoryMutation.mutate({
        id: currentCategory.id,
        category: data,
      }, {
        onSuccess: () => {
          handleEditDialogOpen(false);
        },
      });
    }
  };

  const handleEditCategory = (category: any) => {
    setCurrentCategory(category);
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
            <Button variant="default" className="bg-blue-500 hover:bg-blue-600 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              {t("admin.training.addCategory")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium">{t("admin.training.newCategory")}</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                  <FormField
                    control={addForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("admin.training.categoryName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("admin.training.enterCategoryName")} 
                            className="h-10 px-3 py-2 text-sm"
                            {...field} 
                          />
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
                        <FormLabel className="text-sm font-medium">{t("admin.training.categoryDescription")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("admin.training.enterCategoryDescription")}
                            className="min-h-[80px] text-sm px-3 py-2"
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
                  
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" className="px-4">
                        {t("common.cancel")}
                      </Button>
                    </DialogClose>
                    <Button 
                      type="submit" 
                      disabled={createCategoryMutation.isPending}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4"
                    >
                      {createCategoryMutation.isPending ? t("common.creating") : t("common.create")}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium">{t("admin.training.editCategory")}</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("admin.training.categoryName")}</FormLabel>
                      <FormControl>
                        <Input 
                          className="h-10 px-3 py-2 text-sm"
                          {...field} 
                        />
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
                      <FormLabel className="text-sm font-medium">{t("admin.training.categoryDescription")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="min-h-[80px] text-sm px-3 py-2"
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
                
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="px-4">
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button 
                    type="submit" 
                    disabled={updateCategoryMutation.isPending}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4"
                  >
                    {updateCategoryMutation.isPending
                      ? t("common.saving")
                      : t("common.save")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}