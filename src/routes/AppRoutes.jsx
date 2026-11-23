import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute, { PublicOnlyRoute } from "./ProtectedRoute";
import DashboardLayout from "../layouts/DashboardLayout";

import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Dashboard from "../pages/Dashboard";
import ExamSelection from "../pages/ExamSelection";
import GeneratePaper from "../pages/GeneratePaper";
import Papers from "../pages/Papers";
import PaperPreview from "../pages/PaperPreview";
import QuestionBank from "../pages/QuestionBank";
import Syllabus from "../pages/Syllabus";
import Analytics from "../pages/Analytics";
import Users from "../pages/Users";
import Settings from "../pages/Settings";
import NotFound from "../pages/NotFound";
import Unauthorized from "../pages/Unauthorized";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exams" element={<ExamSelection />} />
          <Route path="/generate" element={<GeneratePaper />} />
          <Route path="/papers" element={<Papers />} />
          <Route path="/papers/:paperId" element={<PaperPreview />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/syllabus" element={<Syllabus />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
