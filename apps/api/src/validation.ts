import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject, ZodError } from "zod";

export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query
      });
      req.body = result.body ?? req.body;
      req.params = result.params ?? req.params;
      req.query = result.query ?? req.query;
      return next();
    } catch (error) {
      const zodError = error as ZodError;
      return res.status(400).json({ message: "ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ", issues: zodError.issues });
    }
  };
}
